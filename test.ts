import {
  Graph,
  Node,
  NodeContext,
  NodeConfig,
  DataFlowMode,
  NodeState,
  DefaultSchedulingStrategy,
  TemporalSchedulingStrategy,
} from './graph';

/**
 * 简单的测试框架
 */
class TestRunner {
  private passed = 0;
  private failed = 0;
  private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  
  test(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }
  
  async run() {
    console.log('🧪 开始运行测试...\n');
    
    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`✅ ${name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ ${name}`);
        console.error('   错误:', error);
      }
    }
    
    console.log(`\n📊 测试结果: ${this.passed} 通过, ${this.failed} 失败`);
    return this.failed === 0;
  }
}

/**
 * 断言工具
 */
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`断言失败: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message || `期望 ${expected}, 实际 ${actual}`
    );
  }
}

function assertDeepEqual<T>(actual: T, expected: T, message?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      message || `期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`
    );
  }
}

/**
 * 测试用的节点类
 */
class TestNode extends Node {
  public executed = false;
  public executionOrder: number = 0;
  private static executionCounter = 0;
  
  protected async run(context: NodeContext): Promise<void> {
    this.executed = true;
    this.executionOrder = ++TestNode.executionCounter;
    
    // 传递数据
    const inputs = this.getInputEndpoints();
    const outputs = this.getOutputEndpoints();
    
    if (inputs.length > 0 && outputs.length > 0) {
      const data = context.getInput(inputs[0].id);
      await context.setOutput(outputs[0].id, data);
    }
  }
  
  static resetCounter() {
    TestNode.executionCounter = 0;
  }
}

class DataNode extends Node {
  private data: any;
  
  constructor(config: NodeConfig, data: any) {
    super(config);
    this.data = data;
  }
  
  protected async run(context: NodeContext): Promise<void> {
    const outputs = this.getOutputEndpoints();
    if (outputs.length > 0) {
      await context.setOutput(outputs[0].id, this.data);
    }
  }
}

class CollectorNode extends Node {
  public collectedData: any[] = [];
  
  protected async run(context: NodeContext): Promise<void> {
    const inputs = this.getInputEndpoints();
    for (const input of inputs) {
      const data = context.getInput(input.id);
      if (data !== undefined) {
        this.collectedData.push(data);
      }
    }
  }
}

/**
 * 测试套件
 */
const runner = new TestRunner();

// 测试 1: 基本节点创建和配置
runner.test('节点创建和配置', async () => {
  const node = new TestNode({
    id: 'test1',
    priority: 5,
    cost: 10,
    timeout: 5000,
    metadata: { type: 'test' }
  });
  
  assertEqual(node.id, 'test1');
  assertEqual(node.priority, 5);
  assertEqual(node.cost, 10);
  assertEqual(node.timeout, 5000);
  assertEqual(node.state, NodeState.PENDING);
});

// 测试 2: 端点创建和管理
runner.test('端点创建和管理', async () => {
  const node = new TestNode({ id: 'test2' });
  
  const input = node.addInputEndpoint('in1', DataFlowMode.PUSH);
  const output = node.addOutputEndpoint('out1', DataFlowMode.PUSH);
  
  assertEqual(input.id, 'in1');
  assertEqual(output.id, 'out1');
  assertEqual(node.getInputEndpoints().length, 1);
  assertEqual(node.getOutputEndpoints().length, 1);
});

// 测试 3: 边的创建和连接
runner.test('边的创建和连接', async () => {
  const graph = new Graph();
  
  const node1 = new TestNode({ id: 'node1' });
  node1.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const node2 = new TestNode({ id: 'node2' });
  node2.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(node1);
  graph.addNode(node2);
  
  const edge = graph.connect('node1', 'out', 'node2', 'in');
  
  assert(edge !== null, '边应该被创建');
  assertEqual(node1.getOutDegree(), 1);
  assertEqual(node2.getInDegree(), 1);
});

// 测试 4: 简单的线性执行
runner.test('简单的线性执行', async () => {
  TestNode.resetCounter();
  const graph = new Graph();
  
  const node1 = new DataNode({ id: 'node1' }, 'data1');
  node1.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const node2 = new TestNode({ id: 'node2' });
  node2.addInputEndpoint('in', DataFlowMode.PUSH);
  node2.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const node3 = new CollectorNode({ id: 'node3' });
  node3.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(node1);
  graph.addNode(node2);
  graph.addNode(node3);
  
  graph.connect('node1', 'out', 'node2', 'in');
  graph.connect('node2', 'out', 'node3', 'in');
  
  await graph.execute();
  
  const stats = graph.getStats();
  assertEqual(stats.states.completed, 3);
  assertEqual(node3.collectedData.length, 1);
  assertEqual(node3.collectedData[0], 'data1');
});

// 测试 5: 并行执行
runner.test('并行执行', async () => {
  TestNode.resetCounter();
  const graph = new Graph({ maxConcurrency: 3 });
  
  const source = new DataNode({ id: 'source' }, 'data');
  source.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodes: TestNode[] = [];
  for (let i = 0; i < 3; i++) {
    const node = new TestNode({ id: `node${i}` });
    node.addInputEndpoint('in', DataFlowMode.PUSH);
    nodes.push(node);
  }
  
  graph.addNode(source);
  nodes.forEach(n => {
    graph.addNode(n);
    graph.connect('source', 'out', n.id, 'in');
  });
  
  await graph.execute();
  
  // 所有节点都应该执行
  assert(nodes.every(n => n.executed), '所有节点都应该被执行');
});

// 测试 6: DAG 依赖执行顺序
runner.test('DAG 依赖执行顺序', async () => {
  TestNode.resetCounter();
  const graph = new Graph({ maxConcurrency: 1 }); // 串行执行以验证顺序
  
  // A -> B -> C
  const nodeA = new TestNode({ id: 'A', priority: 0 });
  nodeA.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeB = new TestNode({ id: 'B', priority: 0 });
  nodeB.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeB.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeC = new TestNode({ id: 'C', priority: 0 });
  nodeC.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(nodeA);
  graph.addNode(nodeB);
  graph.addNode(nodeC);
  
  graph.connect('A', 'out', 'B', 'in');
  graph.connect('B', 'out', 'C', 'in');
  
  await graph.execute();
  
  // 验证执行顺序
  assert(nodeA.executionOrder < nodeB.executionOrder, 'A 应该在 B 之前执行');
  assert(nodeB.executionOrder < nodeC.executionOrder, 'B 应该在 C 之前执行');
});

// 测试 7: 优先级调度
runner.test('优先级调度', async () => {
  TestNode.resetCounter();
  const graph = new Graph({
    maxConcurrency: 1,
    schedulingStrategy: new DefaultSchedulingStrategy()
  });
  
  const highPriority = new TestNode({ id: 'high', priority: 1 });
  const lowPriority = new TestNode({ id: 'low', priority: 10 });
  
  // 先添加低优先级,后添加高优先级
  graph.addNode(lowPriority);
  graph.addNode(highPriority);
  
  await graph.execute();
  
  // 高优先级应该先执行
  assert(
    highPriority.executionOrder < lowPriority.executionOrder,
    '高优先级节点应该先执行'
  );
});

// 测试 8: 动态添加节点
runner.test('动态添加节点', async () => {
  const graph = new Graph();
  
  const node1 = new TestNode({ id: 'node1' });
  graph.addNode(node1);
  
  assertEqual(graph.getStats().totalNodes, 1);
  
  const node2 = new TestNode({ id: 'node2' });
  graph.addNode(node2);
  
  assertEqual(graph.getStats().totalNodes, 2);
});

// 测试 9: 动态删除节点
runner.test('动态删除节点', async () => {
  const graph = new Graph();
  
  const node1 = new TestNode({ id: 'node1' });
  node1.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const node2 = new TestNode({ id: 'node2' });
  node2.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(node1);
  graph.addNode(node2);
  graph.connect('node1', 'out', 'node2', 'in');
  
  assertEqual(graph.getStats().totalNodes, 2);
  assertEqual(graph.getStats().totalEdges, 1);
  
  graph.removeNode('node1');
  
  assertEqual(graph.getStats().totalNodes, 1);
  assertEqual(graph.getStats().totalEdges, 0); // 边应该被自动删除
});

// 测试 10: PUSH 数据流模式
runner.test('PUSH 数据流模式', async () => {
  const graph = new Graph();
  
  const source = new DataNode({ id: 'source' }, { value: 42 });
  source.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const collector = new CollectorNode({ id: 'collector' });
  collector.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(source);
  graph.addNode(collector);
  graph.connect('source', 'out', 'collector', 'in');
  
  await graph.execute();
  
  assertEqual(collector.collectedData.length, 1);
  assertDeepEqual(collector.collectedData[0], { value: 42 });
});

// 测试 11: 复杂 DAG
runner.test('复杂 DAG 执行', async () => {
  TestNode.resetCounter();
  const graph = new Graph({ maxConcurrency: 2 });
  
  /**
   *     A
   *    / \
   *   B   C
   *    \ /
   *     D
   */
  const nodeA = new TestNode({ id: 'A' });
  nodeA.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeB = new TestNode({ id: 'B' });
  nodeB.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeB.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeC = new TestNode({ id: 'C' });
  nodeC.addInputEndpoint('in', DataFlowMode.PUSH);
  nodeC.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const nodeD = new CollectorNode({ id: 'D' });
  nodeD.addInputEndpoint('in1', DataFlowMode.PUSH);
  nodeD.addInputEndpoint('in2', DataFlowMode.PUSH);
  
  graph.addNode(nodeA);
  graph.addNode(nodeB);
  graph.addNode(nodeC);
  graph.addNode(nodeD);
  
  graph.connect('A', 'out', 'B', 'in');
  graph.connect('A', 'out', 'C', 'in');
  graph.connect('B', 'out', 'D', 'in1');
  graph.connect('C', 'out', 'D', 'in2');
  
  await graph.execute();
  
  // 验证所有节点都执行了
  assert(nodeA.executed, 'A 应该执行');
  assert(nodeB.executed, 'B 应该执行');
  assert(nodeC.executed, 'C 应该执行');
  
  // 验证执行顺序
  assert(nodeA.executionOrder < nodeB.executionOrder, 'A 应该在 B 之前');
  assert(nodeA.executionOrder < nodeC.executionOrder, 'A 应该在 C 之前');
  assert(nodeB.executionOrder < nodeD.collectedData.length, 'B 应该在 D 之前');
  assert(nodeC.executionOrder < nodeD.collectedData.length, 'C 应该在 D 之前');
});

// 测试 12: 节点状态转换
runner.test('节点状态转换', async () => {
  const graph = new Graph();
  
  const node = new TestNode({ id: 'node1' });
  
  assertEqual(node.state, NodeState.PENDING);
  
  graph.addNode(node);
  
  // 没有依赖的节点应该变为 READY
  assertEqual(node.state, NodeState.READY);
  
  await graph.execute();
  
  assertEqual(node.state, NodeState.COMPLETED);
});

// 测试 13: 图统计信息
runner.test('图统计信息', async () => {
  const graph = new Graph();
  
  const node1 = new TestNode({ id: 'node1' });
  const node2 = new TestNode({ id: 'node2' });
  node1.addOutputEndpoint('out', DataFlowMode.PUSH);
  node2.addInputEndpoint('in', DataFlowMode.PUSH);
  
  graph.addNode(node1);
  graph.addNode(node2);
  graph.connect('node1', 'out', 'node2', 'in');
  
  const stats = graph.getStats();
  
  assertEqual(stats.totalNodes, 2);
  assertEqual(stats.totalEdges, 1);
  assertEqual(stats.states.ready, 1); // node1 没有依赖
  assertEqual(stats.states.pending, 1); // node2 有依赖
});

// 测试 14: 清空图
runner.test('清空图', async () => {
  const graph = new Graph();
  
  const node1 = new TestNode({ id: 'node1' });
  const node2 = new TestNode({ id: 'node2' });
  
  graph.addNode(node1);
  graph.addNode(node2);
  
  assertEqual(graph.getStats().totalNodes, 2);
  
  graph.clear();
  
  assertEqual(graph.getStats().totalNodes, 0);
  assertEqual(graph.getStats().totalEdges, 0);
});

// 测试 15: 多输入多输出
runner.test('多输入多输出节点', async () => {
  const graph = new Graph();
  
  const source1 = new DataNode({ id: 'source1' }, 'data1');
  source1.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const source2 = new DataNode({ id: 'source2' }, 'data2');
  source2.addOutputEndpoint('out', DataFlowMode.PUSH);
  
  const collector = new CollectorNode({ id: 'collector' });
  collector.addInputEndpoint('in1', DataFlowMode.PUSH);
  collector.addInputEndpoint('in2', DataFlowMode.PUSH);
  
  graph.addNode(source1);
  graph.addNode(source2);
  graph.addNode(collector);
  
  graph.connect('source1', 'out', 'collector', 'in1');
  graph.connect('source2', 'out', 'collector', 'in2');
  
  await graph.execute();
  
  assertEqual(collector.collectedData.length, 2);
  assert(collector.collectedData.includes('data1'), '应该包含 data1');
  assert(collector.collectedData.includes('data2'), '应该包含 data2');
});

// 运行所有测试
(async () => {
  const success = await runner.run();
  process.exit(success ? 0 : 1);
})();

