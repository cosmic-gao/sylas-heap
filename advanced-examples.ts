import {
  Graph,
  Node,
  NodeContext,
  NodeConfig,
  DataFlowMode,
  SchedulingStrategy,
  INode,
} from './graph';

/**
 * 高级示例 1: 自定义调度策略 - 关键路径优先
 * 优先执行关键路径上的节点(出度最大的路径)
 */
class CriticalPathStrategy implements SchedulingStrategy {
  private criticalPathScores: Map<string, number> = new Map();
  
  constructor(graph: Map<string, INode>) {
    this.calculateCriticalPaths(graph);
  }
  
  private calculateCriticalPaths(graph: Map<string, INode>): void {
    // 使用动态规划计算每个节点到终点的最长路径
    const visited = new Set<string>();
    
    const dfs = (node: INode): number => {
      if (visited.has(node.id)) {
        return this.criticalPathScores.get(node.id) || 0;
      }
      
      visited.add(node.id);
      let maxPath = 0;
      
      // 遍历所有下游节点
      for (const output of node.getOutputEndpoints()) {
        for (const edge of output.getEdges()) {
          const downstream = edge.target.node;
          maxPath = Math.max(maxPath, dfs(downstream) + 1);
        }
      }
      
      this.criticalPathScores.set(node.id, maxPath);
      return maxPath;
    };
    
    // 从所有节点开始计算
    for (const node of graph.values()) {
      if (!visited.has(node.id)) {
        dfs(node);
      }
    }
  }
  
  compare(a: INode, b: INode): number {
    const scoreA = this.criticalPathScores.get(a.id) || 0;
    const scoreB = this.criticalPathScores.get(b.id) || 0;
    
    // 关键路径分数高的优先
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    
    // 其次按优先级
    return a.priority - b.priority;
  }
}

/**
 * 高级示例 2: 带缓存的计算节点
 */
class CachedComputeNode extends Node {
  private static cache: Map<string, any> = new Map();
  private computeFn: (inputs: any) => Promise<any>;
  private cacheKey: (inputs: any) => string;
  
  constructor(
    config: NodeConfig,
    computeFn: (inputs: any) => Promise<any>,
    cacheKey?: (inputs: any) => string
  ) {
    super(config);
    this.computeFn = computeFn;
    this.cacheKey = cacheKey || ((inputs) => JSON.stringify(inputs));
  }
  
  protected async run(context: NodeContext): Promise<void> {
    // 收集输入
    const inputs: Record<string, any> = {};
    for (const inputEp of this.getInputEndpoints()) {
      inputs[inputEp.id] = context.getInput(inputEp.id);
    }
    
    // 检查缓存
    const key = this.cacheKey(inputs);
    let result: any;
    
    if (CachedComputeNode.cache.has(key)) {
      console.log(`[${this.id}] 缓存命中: ${key}`);
      result = CachedComputeNode.cache.get(key);
    } else {
      console.log(`[${this.id}] 计算中...`);
      result = await this.computeFn(inputs);
      CachedComputeNode.cache.set(key, result);
    }
    
    // 输出结果
    const outputEps = this.getOutputEndpoints();
    if (outputEps.length > 0) {
      await context.setOutput(outputEps[0].id, result);
    }
  }
  
  static clearCache(): void {
    CachedComputeNode.cache.clear();
  }
}

/**
 * 高级示例 3: 条件分支节点
 */
class ConditionalNode extends Node {
  private condition: (input: any) => boolean;
  
  constructor(
    config: NodeConfig,
    condition: (input: any) => boolean
  ) {
    super(config);
    this.condition = condition;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    const inputs = this.getInputEndpoints();
    const outputs = this.getOutputEndpoints();
    
    if (inputs.length === 0 || outputs.length < 2) {
      throw new Error('ConditionalNode 需要至少 1 个输入和 2 个输出');
    }
    
    const input = context.getInput(inputs[0].id);
    const result = this.condition(input);
    
    // 根据条件选择输出端点
    const targetEndpoint = result ? outputs[0] : outputs[1];
    await context.setOutput(targetEndpoint.id, input);
  }
}

/**
 * 高级示例 4: 聚合节点(等待所有输入)
 */
class AggregateNode extends Node {
  private aggregateFn: (inputs: any[]) => any;
  
  constructor(
    config: NodeConfig,
    aggregateFn: (inputs: any[]) => any
  ) {
    super(config);
    this.aggregateFn = aggregateFn;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    const inputs = this.getInputEndpoints();
    const values: any[] = [];
    
    for (const input of inputs) {
      const value = context.getInput(input.id);
      if (value !== undefined) {
        values.push(value);
      }
    }
    
    const result = this.aggregateFn(values);
    
    const outputs = this.getOutputEndpoints();
    if (outputs.length > 0) {
      await context.setOutput(outputs[0].id, result);
    }
  }
}

/**
 * 高级示例 5: 流式处理节点
 */
class StreamNode extends Node {
  private batchSize: number;
  private processFn: (batch: any[]) => Promise<any[]>;
  
  constructor(
    config: NodeConfig,
    batchSize: number,
    processFn: (batch: any[]) => Promise<any[]>
  ) {
    super(config);
    this.batchSize = batchSize;
    this.processFn = processFn;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    const inputs = this.getInputEndpoints();
    if (inputs.length === 0) return;
    
    const input = context.getInput(inputs[0].id);
    if (!Array.isArray(input)) {
      throw new Error('StreamNode 需要数组输入');
    }
    
    const outputs = this.getOutputEndpoints();
    if (outputs.length === 0) return;
    
    // 分批处理
    for (let i = 0; i < input.length; i += this.batchSize) {
      const batch = input.slice(i, i + this.batchSize);
      const results = await this.processFn(batch);
      
      // 逐个输出结果
      for (const result of results) {
        await context.setOutput(outputs[0].id, result);
      }
    }
  }
}

/**
 * 高级示例 6: 重试节点
 */
class RetryNode extends Node {
  private maxRetries: number;
  private retryDelay: number;
  private executeFn: (inputs: any) => Promise<any>;
  
  constructor(
    config: NodeConfig,
    executeFn: (inputs: any) => Promise<any>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ) {
    super(config);
    this.executeFn = executeFn;
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    const inputs: Record<string, any> = {};
    for (const inputEp of this.getInputEndpoints()) {
      inputs[inputEp.id] = context.getInput(inputEp.id);
    }
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[${this.id}] 尝试 ${attempt + 1}/${this.maxRetries + 1}`);
        const result = await this.executeFn(inputs);
        
        const outputs = this.getOutputEndpoints();
        if (outputs.length > 0) {
          await context.setOutput(outputs[0].id, result);
        }
        
        return; // 成功
      } catch (error) {
        lastError = error as Error;
        console.log(`[${this.id}] 失败: ${lastError.message}`);
        
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
    
    throw new Error(`[${this.id}] 重试 ${this.maxRetries} 次后仍然失败: ${lastError?.message}`);
  }
}

/**
 * 使用场景 1: 数据处理管道(ETL)
 */
export async function advancedExample1_ETLPipeline() {
  console.log('\n=== 高级示例 1: ETL 数据处理管道 ===');
  
  const graph = new Graph({ maxConcurrency: 3 });
  
  // Extract: 数据源
  class ExtractNode extends Node {
    protected async run(context: NodeContext): Promise<void> {
      console.log('[Extract] 从数据源提取数据...');
      const data = [
        { id: 1, name: 'Alice', age: 25 },
        { id: 2, name: 'Bob', age: 30 },
        { id: 3, name: 'Charlie', age: 35 },
      ];
      await context.setOutput('out', data);
    }
  }
  
  // Transform: 数据转换
  const transform = new CachedComputeNode(
    { id: 'transform', priority: 1 },
    async (inputs) => {
      console.log('[Transform] 转换数据...');
      return inputs.in.map((item: any) => ({
        ...item,
        ageGroup: item.age < 30 ? 'young' : 'adult',
      }));
    }
  );
  
  // Load: 数据加载
  class LoadNode extends Node {
    private results: any[] = [];
    
    protected async run(context: NodeContext): Promise<void> {
      const data = context.getInput('in');
      console.log('[Load] 加载数据到目标系统...');
      this.results = data;
      console.log('加载完成:', this.results);
    }
    
    getResults() {
      return this.results;
    }
  }
  
  const extract = new ExtractNode({ id: 'extract', priority: 0 });
  extract.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  transform.addInputEndpoint('in', DataFlowMode.PUSH);
  transform.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const load = new LoadNode({ id: 'load', priority: 2 });
  load.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(extract);
  graph.addNode(transform);
  graph.addNode(load);
  
  graph.connect('extract', 'out', 'transform', 'in');
  graph.connect('transform', 'out', 'load', 'in');
  
  await graph.execute();
  console.log('ETL 完成!');
}

/**
 * 使用场景 2: MapReduce 模式
 */
export async function advancedExample2_MapReduce() {
  console.log('\n=== 高级示例 2: MapReduce 模式 ===');
  
  const graph = new Graph({ maxConcurrency: 3 });
  
  // 数据源
  class DataSource extends Node {
    protected async run(context: NodeContext): Promise<void> {
      const data = Array.from({ length: 100 }, (_, i) => i + 1);
      await context.setOutput('out', data);
    }
  }
  
  // Map: 分发数据到多个 worker
  class MapNode extends Node {
    private workerCount: number;
    
    constructor(config: NodeConfig, workerCount: number) {
      super(config);
      this.workerCount = workerCount;
    }
    
    protected async run(context: NodeContext): Promise<void> {
      const data = context.getInput('in');
      const chunkSize = Math.ceil(data.length / this.workerCount);
      
      const outputs = this.getOutputEndpoints();
      for (let i = 0; i < this.workerCount; i++) {
        const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
        if (outputs[i]) {
          await context.setOutput(outputs[i].id, chunk);
        }
      }
    }
  }
  
  // Worker: 处理数据
  class WorkerNode extends Node {
    protected async run(context: NodeContext): Promise<void> {
      const data = context.getInput('in');
      console.log(`[${this.id}] 处理 ${data.length} 个元素`);
      
      // 计算平方和
      const sum = data.reduce((acc: number, val: number) => acc + val * val, 0);
      await context.setOutput('out', sum);
    }
  }
  
  // Reduce: 聚合结果
  const reduce = new AggregateNode(
    { id: 'reduce', priority: 2 },
    (inputs) => {
      console.log('[Reduce] 聚合结果...');
      return inputs.reduce((acc, val) => acc + val, 0);
    }
  );
  
  // 构建图
  const source = new DataSource({ id: 'source', priority: 0 });
  source.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const workerCount = 4;
  const mapper = new MapNode({ id: 'mapper', priority: 1 }, workerCount);
  mapper.addInputEndpoint('in', DataFlowMode.PUSH);
  for (let i = 0; i < workerCount; i++) {
    mapper.addOutputEndpoint(`out${i}`, DataFlowMode.PUSH);
  }
  
  const workers: WorkerNode[] = [];
  for (let i = 0; i < workerCount; i++) {
    const worker = new WorkerNode({ id: `worker${i}`, priority: 1 });
    worker.addInputEndpoint('in', DataFlowMode.PUSH);
    worker.addOutputEndpoint('out', DataFlowMode.PUSH);
    workers.push(worker);
  }
  
  reduce.addOutputEndpoint('out', DataFlowMode.PUSH);
  for (let i = 0; i < workerCount; i++) {
    reduce.addInputEndpoint(`in${i}`, DataFlowMode.PUSH);
  }
  
  class ResultNode extends Node {
    private result: any;
    
    protected async run(context: NodeContext): Promise<void> {
      this.result = context.getInput('in');
      console.log('[Result] 最终结果:', this.result);
    }
    
    getResult() {
      return this.result;
    }
  }
  
  const result = new ResultNode({ id: 'result', priority: 3 });
  result.addInputEndpoint('in', DataFlowMode.PUSH);
  
  // 添加节点
  graph.addNode(source);
  graph.addNode(mapper);
  workers.forEach(w => graph.addNode(w));
  graph.addNode(reduce);
  graph.addNode(result);
  
  // 连接
  graph.connect('source', 'out', 'mapper', 'in');
  for (let i = 0; i < workerCount; i++) {
    graph.connect('mapper', `out${i}`, `worker${i}`, 'in');
    graph.connect(`worker${i}`, 'out', 'reduce', `in${i}`);
  }
  graph.connect('reduce', 'out', 'result', 'in');
  
  await graph.execute();
  console.log('MapReduce 完成!');
}

/**
 * 使用场景 3: 机器学习管道
 */
export async function advancedExample3_MLPipeline() {
  console.log('\n=== 高级示例 3: 机器学习管道 ===');
  
  const graph = new Graph({ maxConcurrency: 2 });
  
  // 数据加载
  class LoadDataNode extends Node {
    protected async run(context: NodeContext): Promise<void> {
      console.log('[LoadData] 加载训练数据...');
      const data = {
        features: Array.from({ length: 1000 }, () => Math.random()),
        labels: Array.from({ length: 1000 }, () => Math.random() > 0.5 ? 1 : 0),
      };
      await context.setOutput('out', data);
    }
  }
  
  // 数据预处理
  const preprocess = new CachedComputeNode(
    { id: 'preprocess', priority: 1 },
    async (inputs) => {
      console.log('[Preprocess] 数据预处理...');
      const { features, labels } = inputs.in;
      
      // 归一化
      const mean = features.reduce((a: number, b: number) => a + b, 0) / features.length;
      const normalized = features.map((f: number) => (f - mean) / 0.5);
      
      return { features: normalized, labels };
    }
  );
  
  // 特征工程
  class FeatureEngineeringNode extends Node {
    protected async run(context: NodeContext): Promise<void> {
      console.log('[FeatureEngineering] 特征工程...');
      const { features, labels } = context.getInput('in');
      
      // 添加多项式特征
      const engineeredFeatures = features.map((f: number) => [f, f * f, f * f * f]);
      
      await context.setOutput('out', { features: engineeredFeatures, labels });
    }
  }
  
  // 模型训练
  const train = new RetryNode(
    { id: 'train', priority: 2 },
    async (inputs) => {
      console.log('[Train] 训练模型...');
      const { features, labels } = inputs.in;
      
      // 模拟训练过程
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        model: 'trained_model',
        accuracy: 0.95,
        features: features.length,
      };
    },
    2,
    500
  );
  
  // 模型评估
  class EvaluateNode extends Node {
    private metrics: any;
    
    protected async run(context: NodeContext): Promise<void> {
      console.log('[Evaluate] 评估模型...');
      const model = context.getInput('in');
      
      this.metrics = {
        ...model,
        precision: 0.93,
        recall: 0.92,
        f1Score: 0.925,
      };
      
      console.log('评估结果:', this.metrics);
    }
    
    getMetrics() {
      return this.metrics;
    }
  }
  
  // 构建管道
  const loadData = new LoadDataNode({ id: 'loadData', priority: 0 });
  loadData.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  preprocess.addInputEndpoint('in', DataFlowMode.PUSH);
  preprocess.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const featureEng = new FeatureEngineeringNode({ id: 'featureEng', priority: 1 });
  featureEng.addInputEndpoint('in', DataFlowMode.PUSH);
  featureEng.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  train.addInputEndpoint('in', DataFlowMode.PUSH);
  train.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const evaluate = new EvaluateNode({ id: 'evaluate', priority: 3 });
  evaluate.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(loadData);
  graph.addNode(preprocess);
  graph.addNode(featureEng);
  graph.addNode(train);
  graph.addNode(evaluate);
  
  graph.connect('loadData', 'out', 'preprocess', 'in');
  graph.connect('preprocess', 'out', 'featureEng', 'in');
  graph.connect('featureEng', 'out', 'train', 'in');
  graph.connect('train', 'out', 'evaluate', 'in');
  
  await graph.execute();
  console.log('ML 管道完成!');
}

/**
 * 运行所有高级示例
 */
export async function runAdvancedExamples() {
  try {
    await advancedExample1_ETLPipeline();
    await advancedExample2_MapReduce();
    await advancedExample3_MLPipeline();
  } catch (error) {
    console.error('高级示例执行出错:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runAdvancedExamples();
}

