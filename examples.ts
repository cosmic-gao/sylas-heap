import {
  Graph,
  Node,
  NodeContext,
  NodeConfig,
  DataFlowMode,
  DefaultSchedulingStrategy,
  TemporalSchedulingStrategy,
} from './graph';

/**
 * 示例1: 简单的计算节点
 */
class ComputeNode extends Node {
  private computeFn: (inputs: any) => Promise<any>;
  
  constructor(config: NodeConfig, computeFn: (inputs: any) => Promise<any>) {
    super(config);
    this.computeFn = computeFn;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    // 收集所有输入
    const inputs: Record<string, any> = {};
    for (const inputEp of this.getInputEndpoints()) {
      inputs[inputEp.id] = context.getInput(inputEp.id);
    }
    
    // 执行计算
    const result = await this.computeFn(inputs);
    
    // 输出结果
    const outputEps = this.getOutputEndpoints();
    if (outputEps.length > 0) {
      await context.setOutput(outputEps[0].id, result);
    }
  }
}

/**
 * 示例2: 数据源节点(无输入)
 */
class SourceNode extends Node {
  private data: any;
  
  constructor(config: NodeConfig, data: any) {
    super(config);
    this.data = data;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    const outputEps = this.getOutputEndpoints();
    if (outputEps.length > 0) {
      await context.setOutput(outputEps[0].id, this.data);
    }
  }
}

/**
 * 示例3: 数据接收节点(无输出)
 */
class SinkNode extends Node {
  private results: any[] = [];
  
  constructor(config: NodeConfig) {
    super(config);
  }
  
  protected async run(context: NodeContext): Promise<void> {
    const inputs = this.getInputEndpoints();
    for (const inputEp of inputs) {
      const data = context.getInput(inputEp.id);
      this.results.push(data);
    }
  }
  
  getResults(): any[] {
    return [...this.results];
  }
}

/**
 * 示例4: 延迟节点(模拟耗时操作)
 */
class DelayNode extends Node {
  private delayMs: number;
  
  constructor(config: NodeConfig, delayMs: number) {
    super(config);
    this.delayMs = delayMs;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    
    // 传递输入到输出
    const inputs = this.getInputEndpoints();
    const outputs = this.getOutputEndpoints();
    
    if (inputs.length > 0 && outputs.length > 0) {
      const data = context.getInput(inputs[0].id);
      await context.setOutput(outputs[0].id, data);
    }
  }
}

/**
 * 示例使用场景1: 简单的数据处理管道
 * Source -> Transform -> Sink
 */
export async function example1_SimplePipeline() {
  console.log('\n=== 示例1: 简单数据处理管道 ===');
  
  const graph = new Graph({ maxConcurrency: 2 });
  
  // 创建数据源
  const source = new SourceNode({ id: 'source', priority: 0 }, { value: 10 });
  source.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  // 创建转换节点
  const transform = new ComputeNode(
    { id: 'transform', priority: 1 },
    async (inputs) => {
      console.log('Transform 接收:', inputs.in);
      return inputs.in.value * 2;
    }
  );
  transform.addInputEndpoint('in', DataFlowMode.PUSH);
  transform.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  // 创建接收节点
  const sink = new SinkNode({ id: 'sink', priority: 2 });
  sink.addInputEndpoint('in', DataFlowMode.PUSH);
  
  // 添加节点到图
  graph.addNode(source);
  graph.addNode(transform);
  graph.addNode(sink);
  
  // 连接节点
  graph.connect('source', 'out', 'transform', 'in');
  graph.connect('transform', 'out', 'sink', 'in');
  
  // 执行
  console.log('开始执行...');
  await graph.execute();
  console.log('执行完成!');
  console.log('结果:', sink.getResults());
  console.log('统计:', graph.getStats());
}

/**
 * 示例使用场景2: 并行处理
 * Source -> [Worker1, Worker2, Worker3] -> Sink
 */
export async function example2_ParallelProcessing() {
  console.log('\n=== 示例2: 并行处理 ===');
  
  const graph = new Graph({ maxConcurrency: 3 });
  
  // 数据源
  const source = new SourceNode({ id: 'source' }, [1, 2, 3, 4, 5]);
  source.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  // 创建多个并行工作节点
  const workers: ComputeNode[] = [];
  for (let i = 0; i < 3; i++) {
    const worker = new ComputeNode(
      { id: `worker${i}`, priority: 1, cost: i + 1 },
      async (inputs) => {
        console.log(`Worker${i} 处理:`, inputs.in);
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        return inputs.in.map((x: number) => x * (i + 1));
      }
    );
    worker.addInputEndpoint('in', DataFlowMode.PUSH);
    worker.addOutputEndpoint('out', DataFlowMode.PUSH);
    workers.push(worker);
  }
  
  // 汇总节点
  const sink = new SinkNode({ id: 'sink', priority: 2 });
  sink.addInputEndpoint('in', DataFlowMode.PUSH);
  
  // 添加到图
  graph.addNode(source);
  workers.forEach(w => graph.addNode(w));
  graph.addNode(sink);
  
  // 连接:源连接到所有工作节点
  workers.forEach(w => {
    graph.connect('source', 'out', w.id, 'in');
    graph.connect(w.id, 'out', 'sink', 'in');
  });
  
  console.log('开始并行处理...');
  const startTime = Date.now();
  await graph.execute();
  const duration = Date.now() - startTime;
  
  console.log('执行完成!');
  console.log('耗时:', duration, 'ms');
  console.log('结果:', sink.getResults());
  console.log('统计:', graph.getStats());
}

/**
 * 示例使用场景3: 复杂依赖图(DAG)
 *     A
 *    / \
 *   B   C
 *    \ / \
 *     D   E
 *      \ /
 *       F
 */
export async function example3_ComplexDAG() {
  console.log('\n=== 示例3: 复杂依赖图 ===');
  
  const graph = new Graph({ 
    maxConcurrency: 2,
    schedulingStrategy: new DefaultSchedulingStrategy()
  });
  
  // 创建节点
  const nodeA = new ComputeNode({ id: 'A', priority: 0 }, async () => {
    console.log('执行 A');
    return 'A';
  });
  nodeA.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeB = new ComputeNode({ id: 'B', priority: 1 }, async (inputs) => {
    console.log('执行 B, 输入:', inputs.in);
    return 'B';
  });
  nodeB.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeB.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeC = new ComputeNode({ id: 'C', priority: 1 }, async (inputs) => {
    console.log('执行 C, 输入:', inputs.in);
    return 'C';
  });
  nodeC.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeC.addOutputEndpoint('out1', DataFlowMode.PUSH);
  nodeC.addOutputEndpoint('out2', DataFlowMode.PUSH);
  
  const nodeD = new ComputeNode({ id: 'D', priority: 2 }, async (inputs) => {
    console.log('执行 D, 输入:', inputs);
    return 'D';
  });
  nodeD.addInputEndpoint('in1', DataFlowMode.PUSH);
  nodeD.addInputEndpoint('in2', DataFlowMode.PUSH);
  nodeD.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeE = new ComputeNode({ id: 'E', priority: 2 }, async (inputs) => {
    console.log('执行 E, 输入:', inputs.in);
    return 'E';
  });
  nodeE.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeE.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeF = new SinkNode({ id: 'F', priority: 3 });
  nodeF.addInputEndpoint('in1', DataFlowMode.PUSH);
  nodeF.addInputEndpoint('in2', DataFlowMode.PUSH);
  
  // 添加节点
  [nodeA, nodeB, nodeC, nodeD, nodeE, nodeF].forEach(n => graph.addNode(n));
  
  // 连接边
  graph.connect('A', 'out', 'B', 'in');
  graph.connect('A', 'out', 'C', 'in');
  graph.connect('B', 'out', 'D', 'in1');
  graph.connect('C', 'out1', 'D', 'in2');
  graph.connect('C', 'out2', 'E', 'in');
  graph.connect('D', 'out', 'F', 'in1');
  graph.connect('E', 'out', 'F', 'in2');
  
  console.log('开始执行 DAG...');
  await graph.execute();
  console.log('执行完成!');
  console.log('结果:', nodeF.getResults());
  console.log('统计:', graph.getStats());
}

/**
 * 示例使用场景4: 动态添加/删除节点
 */
export async function example4_DynamicGraph() {
  console.log('\n=== 示例4: 动态图操作 ===');
  
  const graph = new Graph({ maxConcurrency: 2 });
  
  // 初始节点
  const source = new SourceNode({ id: 'source' }, 100);
  source.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const sink = new SinkNode({ id: 'sink' });
  sink.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(source);
  graph.addNode(sink);
  graph.connect('source', 'out', 'sink', 'in');
  
  console.log('初始图:', graph.getStats());
  
  // 动态插入中间节点
  console.log('\n动态插入转换节点...');
  const transform = new ComputeNode(
    { id: 'transform', priority: 1 },
    async (inputs) => {
      console.log('Transform 处理:', inputs.in);
      return inputs.in * 2;
    }
  );
  transform.addInputEndpoint('in', DataFlowMode.PUSH);
  transform.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  // 重新连接
  graph.removeEdge('source.out->sink.in');
  graph.addNode(transform);
  graph.connect('source', 'out', 'transform', 'in');
  graph.connect('transform', 'out', 'sink', 'in');
  
  console.log('插入后:', graph.getStats());
  
  // 执行
  await graph.execute();
  console.log('结果:', sink.getResults());
  
  // 动态删除节点
  console.log('\n动态删除转换节点...');
  graph.removeNode('transform');
  console.log('删除后:', graph.getStats());
}

/**
 * 示例使用场景5: Pull 模式数据流
 */
export async function example5_PullMode() {
  console.log('\n=== 示例5: Pull 模式数据流 ===');
  
  const graph = new Graph({ maxConcurrency: 2 });
  
  // 使用 PULL 模式的数据源
  const source = new SourceNode({ id: 'source' }, [1, 2, 3, 4, 5]);
  source.addOutputEndpoint('out', DataFlowMode.PULL);
  
  // 消费者主动拉取数据
  const consumer = new ComputeNode(
    { id: 'consumer', priority: 1 },
    async (inputs) => {
      console.log('Consumer 拉取到:', inputs.in);
      return inputs.in.reduce((sum: number, x: number) => sum + x, 0);
    }
  );
  consumer.addInputEndpoint('in', DataFlowMode.PULL);
  consumer.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const sink = new SinkNode({ id: 'sink' });
  sink.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(source);
  graph.addNode(consumer);
  graph.addNode(sink);
  
  graph.connect('source', 'out', 'consumer', 'in');
  graph.connect('consumer', 'out', 'sink', 'in');
  
  console.log('开始执行 Pull 模式...');
  await graph.execute();
  console.log('结果:', sink.getResults());
}

/**
 * 示例使用场景6: 优先级调度
 */
export async function example6_PriorityScheduling() {
  console.log('\n=== 示例6: 优先级调度 ===');
  
  const graph = new Graph({ 
    maxConcurrency: 1, // 串行执行以观察优先级
    schedulingStrategy: new DefaultSchedulingStrategy()
  });
  
  // 创建不同优先级的任务
  const tasks = [
    { id: 'low', priority: 10, delay: 100 },
    { id: 'high', priority: 1, delay: 100 },
    { id: 'medium', priority: 5, delay: 100 },
    { id: 'urgent', priority: 0, delay: 100 },
  ];
  
  const sink = new SinkNode({ id: 'sink' });
  sink.addInputEndpoint('in', DataFlowMode.PUSH);
  graph.addNode(sink);
  
  for (const task of tasks) {
    const node = new ComputeNode(
      { id: task.id, priority: task.priority },
      async () => {
        console.log(`执行任务: ${task.id} (优先级: ${task.priority})`);
        await new Promise(resolve => setTimeout(resolve, task.delay));
        return task.id;
      }
    );
    node.addOutputEndpoint('out', DataFlowMode.PUSH);
    graph.addNode(node);
    graph.connect(task.id, 'out', 'sink', 'in');
  }
  
  console.log('开始按优先级执行...');
  await graph.execute();
  console.log('执行顺序:', sink.getResults());
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  try {
    await example1_SimplePipeline();
    await example2_ParallelProcessing();
    await example3_ComplexDAG();
    await example4_DynamicGraph();
    await example5_PullMode();
    await example6_PriorityScheduling();
  } catch (error) {
    console.error('示例执行出错:', error);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runAllExamples();
}

