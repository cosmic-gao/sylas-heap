#!/usr/bin/env ts-node

/**
 * 图调度系统 - 综合演示
 * 
 * 这个文件展示了系统的所有核心功能
 */

import {
  Graph,
  Node,
  NodeContext,
  NodeConfig,
  DataFlowMode,
  DefaultSchedulingStrategy,
  TemporalSchedulingStrategy,
} from './graph';

import { GraphVisualizer, GraphMonitor } from './visualizer';

// ============================================================================
// 演示节点定义
// ============================================================================

class SourceNode extends Node {
  private data: any;
  
  constructor(config: NodeConfig, data: any) {
    super(config);
    this.data = data;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    console.log(`[${this.id}] 生成数据:`, this.data);
    const outputs = this.getOutputEndpoints();
    if (outputs.length > 0) {
      await context.setOutput(outputs[0].id, this.data);
    }
  }
}

class TransformNode extends Node {
  private transformFn: (input: any) => any;
  
  constructor(config: NodeConfig, transformFn: (input: any) => any) {
    super(config);
    this.transformFn = transformFn;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    const inputs = this.getInputEndpoints();
    if (inputs.length === 0) return;
    
    const input = context.getInput(inputs[0].id);
    console.log(`[${this.id}] 转换数据:`, input);
    
    const result = this.transformFn(input);
    
    const outputs = this.getOutputEndpoints();
    if (outputs.length > 0) {
      await context.setOutput(outputs[0].id, result);
    }
  }
}

class SinkNode extends Node {
  public results: any[] = [];
  
  protected async run(context: NodeContext): Promise<void> {
    const inputs = this.getInputEndpoints();
    for (const input of inputs) {
      const data = context.getInput(input.id);
      if (data !== undefined) {
        console.log(`[${this.id}] 接收数据:`, data);
        this.results.push(data);
      }
    }
  }
}

// ============================================================================
// 演示场景
// ============================================================================

async function demo1_SimpleLinearPipeline() {
  console.log('\n' + '='.repeat(60));
  console.log('演示 1: 简单线性管道');
  console.log('='.repeat(60));
  
  const graph = new Graph({ maxConcurrency: 1 });
  
  // 创建节点
  const source = new SourceNode({ id: 'Source', priority: 0 }, 100);
  source.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const transform1 = new TransformNode(
    { id: 'Double', priority: 1 },
    (x) => x * 2
  );
  transform1.addInputEndpoint('in', DataFlowMode.PUSH);
  transform1.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const transform2 = new TransformNode(
    { id: 'AddTen', priority: 2 },
    (x) => x + 10
  );
  transform2.addInputEndpoint('in', DataFlowMode.PUSH);
  transform2.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const sink = new SinkNode({ id: 'Sink', priority: 3 });
  sink.addInputEndpoint('in', DataFlowMode.PUSH);
  
  // 构建图
  graph.addNode(source);
  graph.addNode(transform1);
  graph.addNode(transform2);
  graph.addNode(sink);
  
  graph.connect('Source', 'out', 'Double', 'in');
  graph.connect('Double', 'out', 'AddTen', 'in');
  graph.connect('AddTen', 'out', 'Sink', 'in');
  
  // 可视化
  console.log('\n图结构:');
  console.log(GraphVisualizer.toTree(
    [source, transform1, transform2, sink],
    [
      { from: 'Source', to: 'Double' },
      { from: 'Double', to: 'AddTen' },
      { from: 'AddTen', to: 'Sink' },
    ]
  ));
  
  // 执行
  console.log('\n开始执行...\n');
  await graph.execute();
  
  console.log('\n结果:', sink.results);
  console.log('预期: [210] (100 * 2 + 10)');
  console.log('\n' + GraphVisualizer.toASCII(graph));
}

async function demo2_ParallelProcessing() {
  console.log('\n' + '='.repeat(60));
  console.log('演示 2: 并行处理');
  console.log('='.repeat(60));
  
  const graph = new Graph({ maxConcurrency: 3 });
  
  // 数据源
  const source = new SourceNode({ id: 'Source', priority: 0 }, [1, 2, 3, 4, 5]);
  source.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  // 创建 3 个并行工作节点
  const workers: TransformNode[] = [];
  for (let i = 0; i < 3; i++) {
    const worker = new TransformNode(
      { id: `Worker${i}`, priority: 1, cost: i + 1 },
      (arr: number[]) => arr.map(x => x * (i + 1))
    );
    worker.addInputEndpoint('in', DataFlowMode.PUSH);
    worker.addOutputEndpoint('out', DataFlowMode.PUSH);
    workers.push(worker);
  }
  
  // 汇总节点
  const sink = new SinkNode({ id: 'Sink', priority: 2 });
  sink.addInputEndpoint('in', DataFlowMode.PUSH);
  
  // 构建图
  graph.addNode(source);
  workers.forEach(w => graph.addNode(w));
  graph.addNode(sink);
  
  workers.forEach(w => {
    graph.connect('Source', 'out', w.id, 'in');
    graph.connect(w.id, 'out', 'Sink', 'in');
  });
  
  // 可视化
  const nodes = [source, ...workers, sink];
  const edges = [
    ...workers.map(w => ({ from: 'Source', to: w.id })),
    ...workers.map(w => ({ from: w.id, to: 'Sink' })),
  ];
  
  console.log('\n图结构:');
  console.log(GraphVisualizer.toTree(nodes, edges));
  
  // 执行
  console.log('\n开始并行执行...\n');
  const startTime = Date.now();
  await graph.execute();
  const duration = Date.now() - startTime;
  
  console.log('\n结果:', sink.results);
  console.log(`执行时间: ${duration}ms`);
  console.log('\n' + GraphVisualizer.toASCII(graph));
}

async function demo3_ComplexDAG() {
  console.log('\n' + '='.repeat(60));
  console.log('演示 3: 复杂 DAG');
  console.log('='.repeat(60));
  console.log('图结构:');
  console.log('     A');
  console.log('    / \\');
  console.log('   B   C');
  console.log('    \\ / \\');
  console.log('     D   E');
  console.log('      \\ /');
  console.log('       F');
  console.log('');
  
  const graph = new Graph({ 
    maxConcurrency: 2,
    schedulingStrategy: new DefaultSchedulingStrategy()
  });
  
  // 创建节点
  const nodeA = new SourceNode({ id: 'A', priority: 0 }, 'data-A');
  nodeA.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeB = new TransformNode({ id: 'B', priority: 1 }, (x) => x + '-B');
  nodeB.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeB.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeC = new TransformNode({ id: 'C', priority: 1 }, (x) => x + '-C');
  nodeC.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeC.addOutputEndpoint('out1', DataFlowMode.PUSH);
  nodeC.addOutputEndpoint('out2', DataFlowMode.PUSH);
  
  const nodeD = new TransformNode({ id: 'D', priority: 2 }, (x) => x + '-D');
  nodeD.addInputEndpoint('in1', DataFlowMode.PUSH);
  nodeD.addInputEndpoint('in2', DataFlowMode.PUSH);
  nodeD.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeE = new TransformNode({ id: 'E', priority: 2 }, (x) => x + '-E');
  nodeE.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeE.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeF = new SinkNode({ id: 'F', priority: 3 });
  nodeF.addInputEndpoint('in1', DataFlowMode.PUSH);
  nodeF.addInputEndpoint('in2', DataFlowMode.PUSH);
  
  // 构建图
  const nodes = [nodeA, nodeB, nodeC, nodeD, nodeE, nodeF];
  nodes.forEach(n => graph.addNode(n));
  
  graph.connect('A', 'out', 'B', 'in');
  graph.connect('A', 'out', 'C', 'in');
  graph.connect('B', 'out', 'D', 'in1');
  graph.connect('C', 'out1', 'D', 'in2');
  graph.connect('C', 'out2', 'E', 'in');
  graph.connect('D', 'out', 'F', 'in1');
  graph.connect('E', 'out', 'F', 'in2');
  
  const edges = [
    { from: 'A', to: 'B' },
    { from: 'A', to: 'C' },
    { from: 'B', to: 'D' },
    { from: 'C', to: 'D' },
    { from: 'C', to: 'E' },
    { from: 'D', to: 'F' },
    { from: 'E', to: 'F' },
  ];
  
  // 可视化
  console.log('树形结构:');
  console.log(GraphVisualizer.toTree(nodes, edges));
  
  console.log('\n依赖矩阵:');
  console.log(GraphVisualizer.toDependencyMatrix(nodes, edges));
  
  console.log('\n关键路径分析:');
  console.log(GraphVisualizer.analyzeCriticalPath(nodes, edges));
  
  // 执行
  console.log('\n开始执行...\n');
  await graph.execute();
  
  console.log('\n结果:', nodeF.results);
  console.log('\n' + GraphVisualizer.toASCII(graph));
}

async function demo4_DynamicGraph() {
  console.log('\n' + '='.repeat(60));
  console.log('演示 4: 动态图操作');
  console.log('='.repeat(60));
  
  const graph = new Graph({ maxConcurrency: 2 });
  
  // 初始图: Source -> Sink
  const source = new SourceNode({ id: 'Source', priority: 0 }, 100);
  source.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const sink = new SinkNode({ id: 'Sink', priority: 2 });
  sink.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(source);
  graph.addNode(sink);
  graph.connect('Source', 'out', 'Sink', 'in');
  
  console.log('\n初始图:');
  console.log(GraphVisualizer.toASCII(graph));
  
  // 执行
  console.log('\n执行初始图...\n');
  await graph.execute();
  console.log('结果:', sink.results);
  
  // 动态插入中间节点
  console.log('\n动态插入 Transform 节点...');
  
  const transform = new TransformNode(
    { id: 'Transform', priority: 1 },
    (x) => x * 3
  );
  transform.addInputEndpoint('in', DataFlowMode.PUSH);
  transform.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  // 重新连接
  graph.removeEdge('Source.out->Sink.in');
  graph.addNode(transform);
  graph.connect('Source', 'out', 'Transform', 'in');
  graph.connect('Transform', 'out', 'Sink', 'in');
  
  console.log('\n修改后的图:');
  console.log(GraphVisualizer.toASCII(graph));
  
  // 清空结果并重新执行
  sink.results = [];
  
  // 重新创建节点(因为已经执行过了)
  const source2 = new SourceNode({ id: 'Source2', priority: 0 }, 200);
  source2.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const transform2 = new TransformNode(
    { id: 'Transform2', priority: 1 },
    (x) => x * 3
  );
  transform2.addInputEndpoint('in', DataFlowMode.PUSH);
  transform2.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const sink2 = new SinkNode({ id: 'Sink2', priority: 2 });
  sink2.addInputEndpoint('in', DataFlowMode.PUSH);
  
  const graph2 = new Graph({ maxConcurrency: 2 });
  graph2.addNode(source2);
  graph2.addNode(transform2);
  graph2.addNode(sink2);
  graph2.connect('Source2', 'out', 'Transform2', 'in');
  graph2.connect('Transform2', 'out', 'Sink2', 'in');
  
  console.log('\n执行修改后的图...\n');
  await graph2.execute();
  console.log('结果:', sink2.results);
  console.log('预期: [600] (200 * 3)');
}

async function demo5_PriorityScheduling() {
  console.log('\n' + '='.repeat(60));
  console.log('演示 5: 优先级调度');
  console.log('='.repeat(60));
  
  const graph = new Graph({ 
    maxConcurrency: 1,  // 串行执行以观察优先级
    schedulingStrategy: new DefaultSchedulingStrategy()
  });
  
  // 创建不同优先级的任务
  const tasks = [
    { id: 'Low', priority: 10, data: 'low-priority' },
    { id: 'High', priority: 1, data: 'high-priority' },
    { id: 'Medium', priority: 5, data: 'medium-priority' },
    { id: 'Urgent', priority: 0, data: 'urgent-priority' },
  ];
  
  const sink = new SinkNode({ id: 'Sink', priority: 100 });
  sink.addInputEndpoint('in', DataFlowMode.PUSH);
  graph.addNode(sink);
  
  for (const task of tasks) {
    const node = new SourceNode(
      { id: task.id, priority: task.priority },
      task.data
    );
    node.addOutputEndpoint('out', DataFlowMode.PUSH);
    graph.addNode(node);
    graph.connect(task.id, 'out', 'Sink', 'in');
  }
  
  console.log('\n任务列表(按添加顺序):');
  tasks.forEach(t => {
    console.log(`  ${t.id.padEnd(10)} 优先级: ${t.priority}`);
  });
  
  console.log('\n开始按优先级执行...\n');
  await graph.execute();
  
  console.log('\n执行顺序(按结果顺序):');
  sink.results.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result}`);
  });
  
  console.log('\n预期顺序: Urgent → High → Medium → Low');
}

async function demo6_Visualization() {
  console.log('\n' + '='.repeat(60));
  console.log('演示 6: 可视化工具');
  console.log('='.repeat(60));
  
  const graph = new Graph({ maxConcurrency: 2 });
  
  const nodeA = new SourceNode({ id: 'A', priority: 0, cost: 1 }, 'data');
  nodeA.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeB = new TransformNode({ id: 'B', priority: 1, cost: 2 }, (x) => x);
  nodeB.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeB.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeC = new TransformNode({ id: 'C', priority: 1, cost: 1 }, (x) => x);
  nodeC.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeC.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeD = new SinkNode({ id: 'D', priority: 2, cost: 3 });
  nodeD.addInputEndpoint('in1', DataFlowMode.PUSH);
  nodeD.addInputEndpoint('in2', DataFlowMode.PUSH);
  
  const nodes = [nodeA, nodeB, nodeC, nodeD];
  nodes.forEach(n => graph.addNode(n));
  
  graph.connect('A', 'out', 'B', 'in');
  graph.connect('A', 'out', 'C', 'in');
  graph.connect('B', 'out', 'D', 'in1');
  graph.connect('C', 'out', 'D', 'in2');
  
  const edges = [
    { from: 'A', to: 'B' },
    { from: 'A', to: 'C' },
    { from: 'B', to: 'D' },
    { from: 'C', to: 'D' },
  ];
  
  console.log('\n1. Mermaid 流程图:');
  console.log(GraphVisualizer.toMermaid(nodes, edges));
  
  console.log('\n2. Graphviz DOT:');
  console.log(GraphVisualizer.toDOT(nodes, edges));
  
  console.log('\n提示: 复制上面的代码到以下网站查看可视化:');
  console.log('  - Mermaid: https://mermaid.live');
  console.log('  - Graphviz: https://dreampuf.github.io/GraphvizOnline/');
}

// ============================================================================
// 主程序
// ============================================================================

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║              图调度系统 - 综合演示                         ║');
  console.log('║                                                            ║');
  console.log('║  一个强大的基于图的任务调度系统                            ║');
  console.log('║  支持复杂依赖、优先级调度、并发控制和动态管理              ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    await demo1_SimpleLinearPipeline();
    await demo2_ParallelProcessing();
    await demo3_ComplexDAG();
    await demo4_DynamicGraph();
    await demo5_PriorityScheduling();
    await demo6_Visualization();
    
    console.log('\n' + '='.repeat(60));
    console.log('所有演示完成! ✨');
    console.log('='.repeat(60));
    console.log('\n下一步:');
    console.log('  - 查看 examples.ts 了解更多基础示例');
    console.log('  - 查看 advanced-examples.ts 了解高级用法');
    console.log('  - 查看 QUICK_START.md 快速开始');
    console.log('  - 查看 ARCHITECTURE.md 了解架构设计');
    console.log('  - 运行 npm test 执行测试');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ 演示执行出错:', error);
    process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main();
}

export { main as runDemo };

