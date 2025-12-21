/**
 * 图调度模块
 * 
 * 提供图调度系统的核心实现
 * 负责节点管理、边管理、依赖分析和任务调度
 */

import { PairingHeap, PairingNode } from './index';
import { INode, NodeState, NodeContext } from './Node';
import { Edge } from './Edge';

/**
 * 调度策略接口
 * 
 * 定义了节点优先级比较的策略
 * 
 * @interface
 * 
 * @example
 * ```typescript
 * class CustomStrategy implements SchedulingStrategy {
 *   compare(a: INode, b: INode): number {
 *     return a.priority - b.priority;
 *   }
 * }
 * ```
 */
export interface SchedulingStrategy {
  /**
   * 比较两个节点的优先级
   * 
   * @param {INode} a - 第一个节点
   * @param {INode} b - 第二个节点
   * @returns {number} 返回负数表示 a 优先于 b，返回正数表示 b 优先于 a，返回 0 表示优先级相同
   * 
   * @example
   * ```typescript
   * const result = strategy.compare(nodeA, nodeB);
   * if (result < 0) {
   *   console.log('nodeA 优先于 nodeB');
   * }
   * ```
   */
  compare(a: INode, b: INode): number;
}

/**
 * 默认调度策略
 * 
 * 综合考虑优先级、依赖和成本：
 * 1. 首先按优先级（数值越小优先级越高）
 * 2. 然后按入度（依赖少的优先）
 * 3. 最后按成本（成本低的优先）
 * 
 * @class
 * @implements {SchedulingStrategy}
 * 
 * @example
 * ```typescript
 * const strategy = new DefaultSchedulingStrategy();
 * const graph = new Graph({ schedulingStrategy: strategy });
 * ```
 */
export class DefaultSchedulingStrategy implements SchedulingStrategy {
  /**
   * 比较两个节点的优先级
   * 
   * @param {INode} a - 第一个节点
   * @param {INode} b - 第二个节点
   * @returns {number} 比较结果
   * 
   * @example
   * ```typescript
   * const result = strategy.compare(nodeA, nodeB);
   * ```
   */
  compare(a: INode, b: INode): number {
    // 1. 首先按优先级(数值越小优先级越高)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    
    // 2. 然后按入度(依赖少的优先)
    const inDegreeA = a.getInDegree();
    const inDegreeB = b.getInDegree();
    if (inDegreeA !== inDegreeB) {
      return inDegreeA - inDegreeB;
    }
    
    // 3. 最后按成本(成本低的优先)
    return a.cost - b.cost;
  }
}

/**
 * 时序调度策略
 * 
 * 按节点插入的时间顺序执行
 * 先插入的节点优先执行
 * 
 * @class
 * @implements {SchedulingStrategy}
 * 
 * @example
 * ```typescript
 * const strategy = new TemporalSchedulingStrategy();
 * const graph = new Graph({ schedulingStrategy: strategy });
 * ```
 */
export class TemporalSchedulingStrategy implements SchedulingStrategy {
  /** 节点插入顺序映射表 */
  private insertionOrder: Map<string, number> = new Map();
  /** 插入计数器 */
  private counter = 0;
  
  /**
   * 注册节点到调度策略
   * 
   * 记录节点的插入顺序
   * 
   * @param {INode} node - 要注册的节点
   * @returns {void}
   * 
   * @example
   * ```typescript
   * strategy.registerNode(node);
   * ```
   */
  registerNode(node: INode): void {
    if (!this.insertionOrder.has(node.id)) {
      this.insertionOrder.set(node.id, this.counter++);
    }
  }
  
  /**
   * 比较两个节点的优先级
   * 
   * 按插入顺序比较，先插入的优先
   * 
   * @param {INode} a - 第一个节点
   * @param {INode} b - 第二个节点
   * @returns {number} 比较结果
   * 
   * @example
   * ```typescript
   * const result = strategy.compare(nodeA, nodeB);
   * ```
   */
  compare(a: INode, b: INode): number {
    const orderA = this.insertionOrder.get(a.id) ?? Infinity;
    const orderB = this.insertionOrder.get(b.id) ?? Infinity;
    return orderA - orderB;
  }
}

/**
 * 图配置接口
 * 
 * 用于创建图时的配置选项
 * 
 * @interface
 * 
 * @example
 * ```typescript
 * const config: GraphConfig = {
 *   maxConcurrency: 4,
 *   schedulingStrategy: new DefaultSchedulingStrategy(),
 *   enableDynamicScheduling: true
 * };
 * ```
 */
export interface GraphConfig {
  /** 最大并发数，限制同时执行的节点数量，默认为 4 */
  maxConcurrency?: number;
  /** 调度策略，默认为 DefaultSchedulingStrategy */
  schedulingStrategy?: SchedulingStrategy;
  /** 是否启用动态调度，默认为 true */
  enableDynamicScheduling?: boolean;
}

/**
 * 图类
 * 
 * 任务调度的核心，负责节点管理、边管理、依赖分析和任务调度
 * 
 * @class
 * 
 * @example
 * ```typescript
 * const graph = new Graph({ maxConcurrency: 4 });
 * 
 * const node1 = new MyNode({ id: 'node1' });
 * const node2 = new MyNode({ id: 'node2' });
 * 
 * graph.addNode(node1);
 * graph.addNode(node2);
 * graph.connect('node1', 'out', 'node2', 'in');
 * 
 * await graph.execute();
 * ```
 */
export class Graph {
  /** 节点映射表 */
  private nodes: Map<string, INode> = new Map();
  /** 边映射表 */
  private edges: Map<string, Edge> = new Map();
  /** 就绪节点优先级队列 */
  private readyQueue: PairingHeap<INode>;
  /** 节点在堆中的引用映射表 */
  private nodeHeapNodes: Map<string, PairingNode<INode>> = new Map();
  
  /** 最大并发数 */
  private maxConcurrency: number;
  /** 调度策略 */
  private schedulingStrategy: SchedulingStrategy;
  /** 是否启用动态调度 */
  private enableDynamicScheduling: boolean;
  
  /** 正在运行的节点 ID 集合 */
  private runningNodes: Set<string> = new Set();
  /** 已完成的节点 ID 集合 */
  private completedNodes: Set<string> = new Set();
  
  /**
   * 创建图实例
   * 
   * @param {GraphConfig} config - 图配置，可选
   * 
   * @example
   * ```typescript
   * const graph = new Graph({
   *   maxConcurrency: 4,
   *   schedulingStrategy: new DefaultSchedulingStrategy()
   * });
   * ```
   */
  constructor(config: GraphConfig = {}) {
    this.maxConcurrency = config.maxConcurrency ?? 4;
    this.schedulingStrategy = config.schedulingStrategy ?? new DefaultSchedulingStrategy();
    this.enableDynamicScheduling = config.enableDynamicScheduling ?? true;
    
    this.readyQueue = new PairingHeap<INode>(
      (a, b) => this.schedulingStrategy.compare(a, b)
    );
  }
  
  /**
   * 添加节点到图
   * 
   * 如果节点已就绪（依赖满足），会自动加入就绪队列
   * 
   * @param {INode} node - 要添加的节点
   * @returns {void}
   * @throws {Error} 如果节点 ID 已存在会抛出错误
   * 
   * @example
   * ```typescript
   * const node = new MyNode({ id: 'node1' });
   * graph.addNode(node);
   * ```
   */
  addNode(node: INode): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`Node ${node.id} already exists`);
    }
    
    this.nodes.set(node.id, node);
    
    // 如果启用时序调度,注册节点
    if (this.schedulingStrategy instanceof TemporalSchedulingStrategy) {
      this.schedulingStrategy.registerNode(node);
    }
    
    // 如果节点已就绪,加入就绪队列
    if (node.isReady()) {
      node.state = NodeState.READY;
      const heapNode = this.readyQueue.insert(node);
      this.nodeHeapNodes.set(node.id, heapNode);
    }
  }
  
  /**
   * 从图中删除节点
   * 
   * 会自动取消正在运行的节点，移除所有相关的边，并从就绪队列中移除
   * 
   * @param {string} nodeId - 要删除的节点 ID
   * @returns {void}
   * 
   * @example
   * ```typescript
   * graph.removeNode('node1');
   * ```
   */
  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    
    // 取消正在运行的节点
    if (node.state === NodeState.RUNNING) {
      node.cancel();
      this.runningNodes.delete(nodeId);
    }
    
    // 从就绪队列中移除
    const heapNode = this.nodeHeapNodes.get(nodeId);
    if (heapNode) {
      this.readyQueue.delete(heapNode);
      this.nodeHeapNodes.delete(nodeId);
    }
    
    // 移除所有相关的边
    const edgesToRemove: string[] = [];
    for (const [edgeId, edge] of this.edges) {
      if (edge.source.node.id === nodeId || edge.target.node.id === nodeId) {
        edgesToRemove.push(edgeId);
      }
    }
    edgesToRemove.forEach(edgeId => this.removeEdge(edgeId));
    
    // 移除节点
    this.nodes.delete(nodeId);
    this.completedNodes.delete(nodeId);
  }
  
  /**
   * 连接两个端点
   * 
   * 创建一条边连接源节点的输出端点和目标节点的输入端点
   * 
   * @template T 边传输的数据类型
   * @param {string} sourceNodeId - 源节点 ID
   * @param {string} sourceEndpointId - 源节点输出端点 ID
   * @param {string} targetNodeId - 目标节点 ID
   * @param {string} targetEndpointId - 目标节点输入端点 ID
   * @returns {Edge<T>} 创建的边实例
   * @throws {Error} 如果节点或端点不存在，或端点无法连接会抛出错误
   * 
   * @example
   * ```typescript
   * const edge = graph.connect('node1', 'out', 'node2', 'in');
   * ```
   */
  connect<T = any>(
    sourceNodeId: string,
    sourceEndpointId: string,
    targetNodeId: string,
    targetEndpointId: string
  ): Edge<T> {
    const sourceNode = this.nodes.get(sourceNodeId);
    const targetNode = this.nodes.get(targetNodeId);
    
    if (!sourceNode || !targetNode) {
      throw new Error('Source or target node not found');
    }
    
    const sourceEndpoint = sourceNode.getOutputEndpoint(sourceEndpointId);
    const targetEndpoint = targetNode.getInputEndpoint(targetEndpointId);
    
    if (!sourceEndpoint || !targetEndpoint) {
      throw new Error('Source or target endpoint not found');
    }
    
    if (!sourceEndpoint.canConnect(targetEndpoint)) {
      throw new Error('Cannot connect these endpoints');
    }
    
    const edgeId = `${sourceNodeId}.${sourceEndpointId}->${targetNodeId}.${targetEndpointId}`;
    const edge = new Edge<T>(edgeId, sourceEndpoint, targetEndpoint);
    
    sourceEndpoint.addEdge(edge);
    targetEndpoint.addEdge(edge);
    this.edges.set(edgeId, edge);
    
    return edge;
  }
  
  /**
   * 移除边
   * 
   * 从图中删除指定的边，并检查目标节点是否变为就绪状态
   * 
   * @param {string} edgeId - 要删除的边 ID
   * @returns {void}
   * 
   * @example
   * ```typescript
   * graph.removeEdge('node1.out->node2.in');
   * ```
   */
  removeEdge(edgeId: string): void {
    const edge = this.edges.get(edgeId);
    if (!edge) return;
    
    edge.source.removeEdge(edge);
    edge.target.removeEdge(edge);
    this.edges.delete(edgeId);
    
    // 检查目标节点是否变为就绪状态
    this.checkNodeReady(edge.target.node);
  }
  
  /**
   * 检查节点是否就绪并更新队列
   * 
   * 如果节点就绪，将其加入就绪队列
   * 
   * @private
   * @param {INode} node - 要检查的节点
   * @returns {void}
   */
  private checkNodeReady(node: INode): void {
    if (node.state === NodeState.PENDING && node.isReady()) {
      node.state = NodeState.READY;
      const heapNode = this.readyQueue.insert(node);
      this.nodeHeapNodes.set(node.id, heapNode);
    }
  }
  
  /**
   * 执行图调度
   * 
   * 按照调度策略执行所有节点，直到所有节点完成或失败
   * 会控制并发数量，确保不超过 maxConcurrency
   * 
   * @returns {Promise<void>} 执行完成的 Promise
   * 
   * @example
   * ```typescript
   * await graph.execute();
   * ```
   */
  async execute(): Promise<void> {
    const executionPromises: Promise<void>[] = [];
    
    while (
      this.readyQueue.size() > 0 ||
      this.runningNodes.size > 0
    ) {
      // 启动新任务直到达到并发限制
      while (
        this.readyQueue.size() > 0 &&
        this.runningNodes.size < this.maxConcurrency
      ) {
        const node = this.readyQueue.poll();
        if (!node) break;
        
        this.nodeHeapNodes.delete(node.id);
        this.runningNodes.add(node.id);
        
        // 异步执行节点
        const promise = this.executeNode(node);
        executionPromises.push(promise);
      }
      
      // 等待至少一个任务完成
      if (this.runningNodes.size > 0) {
        await Promise.race(executionPromises);
      }
    }
    
    // 等待所有任务完成
    await Promise.all(executionPromises);
  }
  
  /**
   * 执行单个节点
   * 
   * 收集输入数据，执行节点，检查下游节点是否就绪
   * 
   * @private
   * @param {INode} node - 要执行的节点
   * @returns {Promise<void>} 执行完成的 Promise
   */
  private async executeNode(node: INode): Promise<void> {
    const context = this.createNodeContext(node);
    
    try {
      // 收集输入数据
      const inputs = new Map<string, any>();
      for (const inputEp of node.getInputEndpoints()) {
        const data = await inputEp.pullData();
        inputs.set(inputEp.id, data);
      }
      
      // 更新上下文中的 inputs
      context.inputs.clear();
      for (const [key, value] of inputs) {
        context.inputs.set(key, value);
      }
      
      // 执行节点
      await node.execute(context);
      
      this.completedNodes.add(node.id);
      
      // 检查下游节点是否就绪
      for (const outputEp of node.getOutputEndpoints()) {
        for (const edge of outputEp.getEdges()) {
          this.checkNodeReady(edge.target.node);
        }
      }
    } catch (error) {
      console.error(`Node ${node.id} execution failed:`, error);
      throw error;
    } finally {
      this.runningNodes.delete(node.id);
    }
  }
  
  /**
   * 创建节点执行上下文
   * 
   * 为节点执行提供上下文环境
   * 
   * @private
   * @param {INode} node - 要创建上下文的节点
   * @returns {NodeContext} 节点执行上下文
   */
  private createNodeContext(node: INode): NodeContext {
    const abortController = new AbortController();
    const inputs = new Map<string, any>();
    
    return {
      node,
      inputs,
      signal: abortController.signal,
      
      getInput<T>(endpointId: string): T | undefined {
        return inputs.get(endpointId);
      },
      
      async setOutput<T>(endpointId: string, data: T): Promise<void> {
        const endpoint = node.getOutputEndpoint(endpointId);
        if (endpoint) {
          await endpoint.pushData(data);
        }
      },
    };
  }
  
  /**
   * 获取图的统计信息
   * 
   * 返回图中节点的数量、边的数量、各状态的节点数量等信息
   * 
   * @returns {object} 统计信息对象
   * 
   * @example
   * ```typescript
   * const stats = graph.getStats();
   * console.log(`总节点数: ${stats.totalNodes}`);
   * console.log(`运行中: ${stats.runningNodes}`);
   * ```
   */
  getStats() {
    const states: Record<string, number> = {
      pending: 0,
      ready: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    
    for (const node of this.nodes.values()) {
      const stateKey = node.state as keyof typeof states;
      if (states.hasOwnProperty(stateKey)) {
        states[stateKey]++;
      }
    }
    
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      states,
      runningNodes: this.runningNodes.size,
      readyNodes: this.readyQueue.size(),
    };
  }
  
  /**
   * 清空图
   * 
   * 取消所有运行中的节点，清空所有节点和边
   * 
   * @returns {void}
   * 
   * @example
   * ```typescript
   * graph.clear();
   * ```
   */
  clear(): void {
    // 取消所有运行中的节点
    for (const nodeId of this.runningNodes) {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.cancel();
      }
    }
    
    this.nodes.clear();
    this.edges.clear();
    this.readyQueue.clear();
    this.nodeHeapNodes.clear();
    this.runningNodes.clear();
    this.completedNodes.clear();
  }
}

