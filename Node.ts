/**
 * 节点模块
 * 
 * 提供图调度系统中节点的实现
 * 节点是执行单元，包含业务逻辑和输入/输出端点
 */

import { InputEndpoint, OutputEndpoint, DataFlowMode } from './Endpoint';

/**
 * 节点状态枚举
 * 
 * @enum {string}
 * @readonly
 */
export enum NodeState {
  /** 等待执行 - 节点已创建但尚未就绪 */
  PENDING = 'pending',
  /** 准备执行 - 依赖已满足，可以开始执行 */
  READY = 'ready',
  /** 正在执行 - 节点当前正在运行 */
  RUNNING = 'running',
  /** 已完成 - 节点执行成功完成 */
  COMPLETED = 'completed',
  /** 执行失败 - 节点执行过程中出现错误 */
  FAILED = 'failed',
  /** 已取消 - 节点执行被取消 */
  CANCELLED = 'cancelled',
}

/**
 * 节点执行上下文接口
 * 
 * 在执行节点时提供上下文环境，包括输入数据访问和输出数据设置
 * 
 * @interface
 * 
 * @example
 * ```typescript
 * protected async run(context: NodeContext): Promise<void> {
 *   const input = context.getInput('input1');
 *   const result = await processData(input);
 *   await context.setOutput('output1', result);
 * }
 * ```
 */
export interface NodeContext {
  /** 当前执行的节点 */
  readonly node: INode;
  /** 输入数据映射表 */
  readonly inputs: Map<string, any>;
  /** 取消信号，用于取消节点执行 */
  readonly signal: AbortSignal;
  
  /**
   * 获取指定端点的输入数据
   * 
   * @template T 输入数据的类型
   * @param {string} endpointId - 输入端点的标识符
   * @returns {T | undefined} 输入数据，如果不存在则返回 undefined
   * 
   * @example
   * ```typescript
   * const data = context.getInput<number>('input1');
   * if (data !== undefined) {
   *   console.log('输入数据:', data);
   * }
   * ```
   */
  getInput<T>(endpointId: string): T | undefined;
  
  /**
   * 设置指定端点的输出数据
   * 
   * @template T 输出数据的类型
   * @param {string} endpointId - 输出端点的标识符
   * @param {T} data - 要输出的数据
   * @returns {Promise<void>} 设置完成的 Promise
   * 
   * @example
   * ```typescript
   * await context.setOutput('output1', { result: 100 });
   * ```
   */
  setOutput<T>(endpointId: string, data: T): Promise<void>;
}

/**
 * 节点配置接口
 * 
 * 用于创建节点时的配置选项
 * 
 * @interface
 * 
 * @example
 * ```typescript
 * const config: NodeConfig = {
 *   id: 'my-node',
 *   priority: 1,
 *   cost: 10,
 *   timeout: 5000,
 *   retries: 3,
 *   metadata: { type: 'compute' }
 * };
 * ```
 */
export interface NodeConfig {
  /** 节点的唯一标识符 */
  id: string;
  /** 优先级，数值越小优先级越高，默认为 0 */
  priority?: number;
  /** 执行成本估算，用于调度优化，默认为 1 */
  cost?: number;
  /** 超时时间（毫秒），默认为 30000 */
  timeout?: number;
  /** 重试次数，默认为 0 */
  retries?: number;
  /** 自定义元数据，可以存储任意键值对 */
  metadata?: Record<string, any>;
}

/**
 * 节点接口
 * 
 * 定义了节点的基本行为和属性
 * 
 * @interface
 */
export interface INode {
  /** 节点的唯一标识符 */
  readonly id: string;
  /** 优先级，数值越小优先级越高 */
  readonly priority: number;
  /** 执行成本估算 */
  readonly cost: number;
  /** 超时时间（毫秒） */
  readonly timeout: number;
  /** 重试次数 */
  readonly retries: number;
  /** 自定义元数据 */
  readonly metadata: Record<string, any>;
  
  /** 节点当前状态 */
  state: NodeState;
  
  /**
   * 获取所有输入端点
   * 
   * @returns {InputEndpoint[]} 输入端点数组
   */
  getInputEndpoints(): InputEndpoint[];
  
  /**
   * 获取所有输出端点
   * 
   * @returns {OutputEndpoint[]} 输出端点数组
   */
  getOutputEndpoints(): OutputEndpoint[];
  
  /**
   * 根据 ID 获取输入端点
   * 
   * @param {string} id - 端点标识符
   * @returns {InputEndpoint | undefined} 输入端点，如果不存在则返回 undefined
   */
  getInputEndpoint(id: string): InputEndpoint | undefined;
  
  /**
   * 根据 ID 获取输出端点
   * 
   * @param {string} id - 端点标识符
   * @returns {OutputEndpoint | undefined} 输出端点，如果不存在则返回 undefined
   */
  getOutputEndpoint(id: string): OutputEndpoint | undefined;
  
  /**
   * 获取节点的入度（输入依赖数量）
   * 
   * @returns {number} 入度值
   */
  getInDegree(): number;
  
  /**
   * 获取节点的出度（输出连接数量）
   * 
   * @returns {number} 出度值
   */
  getOutDegree(): number;
  
  /**
   * 检查节点是否就绪（依赖是否满足）
   * 
   * @returns {boolean} 如果就绪返回 true，否则返回 false
   */
  isReady(): boolean;
  
  /**
   * 执行节点
   * 
   * @param {NodeContext} context - 执行上下文
   * @returns {Promise<void>} 执行完成的 Promise
   */
  execute(context: NodeContext): Promise<void>;
  
  /**
   * 取消节点执行
   * 
   * @returns {void}
   */
  cancel(): void;
}

/**
 * 抽象节点基类
 * 
 * 所有自定义节点都应该继承此类并实现 run() 方法
 * 
 * @abstract
 * @class
 * @implements {INode}
 * 
 * @example
 * ```typescript
 * class MyNode extends Node {
 *   constructor(config: NodeConfig) {
 *     super(config);
 *     this.addInputEndpoint('in');
 *     this.addOutputEndpoint('out');
 *   }
 *   
 *   protected async run(context: NodeContext): Promise<void> {
 *     const input = context.getInput('in');
 *     const result = await processData(input);
 *     await context.setOutput('out', result);
 *   }
 * }
 * ```
 */
export abstract class Node implements INode {
  /** 节点的唯一标识符 */
  readonly id: string;
  /** 优先级，数值越小优先级越高 */
  readonly priority: number;
  /** 执行成本估算 */
  readonly cost: number;
  /** 超时时间（毫秒） */
  readonly timeout: number;
  /** 重试次数 */
  readonly retries: number;
  /** 自定义元数据 */
  readonly metadata: Record<string, any>;
  
  /** 节点当前状态 */
  state: NodeState = NodeState.PENDING;
  
  /** 输入端点映射表 */
  protected inputEndpoints: Map<string, InputEndpoint> = new Map();
  /** 输出端点映射表 */
  protected outputEndpoints: Map<string, OutputEndpoint> = new Map();
  /** 取消控制器，用于取消节点执行 */
  protected abortController: AbortController | null = null;
  
  /**
   * 创建节点实例
   * 
   * @param {NodeConfig} config - 节点配置
   * 
   * @example
   * ```typescript
   * const node = new MyNode({
   *   id: 'node1',
   *   priority: 1,
   *   cost: 10
   * });
   * ```
   */
  constructor(config: NodeConfig) {
    this.id = config.id;
    this.priority = config.priority ?? 0;
    this.cost = config.cost ?? 1;
    this.timeout = config.timeout ?? 30000;
    this.retries = config.retries ?? 0;
    this.metadata = config.metadata ?? {};
  }
  
  /**
   * 添加输入端点
   * 
   * @param {string} id - 端点的唯一标识符
   * @param {DataFlowMode} dataFlowMode - 数据流模式，默认为 PUSH
   * @returns {InputEndpoint} 创建的输入端点实例
   * 
   * @example
   * ```typescript
   * const inputEp = node.addInputEndpoint('input1', DataFlowMode.PUSH);
   * ```
   */
  addInputEndpoint(id: string, dataFlowMode: DataFlowMode = DataFlowMode.PUSH): InputEndpoint {
    const endpoint = new InputEndpoint(id, this, dataFlowMode);
    this.inputEndpoints.set(id, endpoint);
    return endpoint;
  }
  
  /**
   * 添加输出端点
   * 
   * @param {string} id - 端点的唯一标识符
   * @param {DataFlowMode} dataFlowMode - 数据流模式，默认为 PUSH
   * @returns {OutputEndpoint} 创建的输出端点实例
   * 
   * @example
   * ```typescript
   * const outputEp = node.addOutputEndpoint('output1', DataFlowMode.PUSH);
   * ```
   */
  addOutputEndpoint(id: string, dataFlowMode: DataFlowMode = DataFlowMode.PUSH): OutputEndpoint {
    const endpoint = new OutputEndpoint(id, this, dataFlowMode);
    this.outputEndpoints.set(id, endpoint);
    return endpoint;
  }
  
  /**
   * 获取所有输入端点
   * 
   * @returns {InputEndpoint[]} 输入端点数组
   * 
   * @example
   * ```typescript
   * const inputs = node.getInputEndpoints();
   * console.log(`节点有 ${inputs.length} 个输入端点`);
   * ```
   */
  getInputEndpoints(): InputEndpoint[] {
    return Array.from(this.inputEndpoints.values());
  }
  
  /**
   * 获取所有输出端点
   * 
   * @returns {OutputEndpoint[]} 输出端点数组
   * 
   * @example
   * ```typescript
   * const outputs = node.getOutputEndpoints();
   * console.log(`节点有 ${outputs.length} 个输出端点`);
   * ```
   */
  getOutputEndpoints(): OutputEndpoint[] {
    return Array.from(this.outputEndpoints.values());
  }
  
  /**
   * 根据 ID 获取输入端点
   * 
   * @param {string} id - 端点标识符
   * @returns {InputEndpoint | undefined} 输入端点，如果不存在则返回 undefined
   * 
   * @example
   * ```typescript
   * const inputEp = node.getInputEndpoint('input1');
   * if (inputEp) {
   *   console.log('找到输入端点:', inputEp.id);
   * }
   * ```
   */
  getInputEndpoint(id: string): InputEndpoint | undefined {
    return this.inputEndpoints.get(id);
  }
  
  /**
   * 根据 ID 获取输出端点
   * 
   * @param {string} id - 端点标识符
   * @returns {OutputEndpoint | undefined} 输出端点，如果不存在则返回 undefined
   * 
   * @example
   * ```typescript
   * const outputEp = node.getOutputEndpoint('output1');
   * if (outputEp) {
   *   console.log('找到输出端点:', outputEp.id);
   * }
   * ```
   */
  getOutputEndpoint(id: string): OutputEndpoint | undefined {
    return this.outputEndpoints.get(id);
  }
  
  /**
   * 获取节点的入度（输入依赖数量）
   * 
   * 入度等于所有输入端点连接的边数之和
   * 
   * @returns {number} 入度值
   * 
   * @example
   * ```typescript
   * const inDegree = node.getInDegree();
   * console.log(`节点有 ${inDegree} 个输入依赖`);
   * ```
   */
  getInDegree(): number {
    return this.getInputEndpoints().reduce(
      (sum, ep) => sum + ep.getEdges().length,
      0
    );
  }
  
  /**
   * 获取节点的出度（输出连接数量）
   * 
   * 出度等于所有输出端点连接的边数之和
   * 
   * @returns {number} 出度值
   * 
   * @example
   * ```typescript
   * const outDegree = node.getOutDegree();
   * console.log(`节点有 ${outDegree} 个输出连接`);
   * ```
   */
  getOutDegree(): number {
    return this.getOutputEndpoints().reduce(
      (sum, ep) => sum + ep.getEdges().length,
      0
    );
  }
  
  /**
   * 检查节点是否就绪（依赖是否满足）
   * 
   * 节点就绪的条件：
   * 1. 状态为 PENDING
   * 2. 所有输入端点都有数据（PUSH 模式）或上游有数据（PULL 模式）
   * 3. 没有输入的节点总是就绪
   * 
   * @returns {boolean} 如果就绪返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * if (node.isReady()) {
   *   console.log('节点可以开始执行');
   * }
   * ```
   */
  isReady(): boolean {
    if (this.state !== NodeState.PENDING) {
      return false;
    }
    
    // 检查所有输入端点是否有数据或没有连接
    const inputs = this.getInputEndpoints();
    if (inputs.length === 0) {
      return true; // 没有输入的节点总是就绪
    }
    
    return inputs.every(ep => {
      const edges = ep.getEdges();
      if (edges.length === 0) {
        return true; // 没有连接的输入端点视为就绪
      }
      
      if (ep.dataFlowMode === DataFlowMode.PUSH) {
        return ep.hasData(); // PUSH 模式需要有数据
      } else {
        // PULL 模式检查上游是否有数据
        return edges.some(edge => edge.source.hasData());
      }
    });
  }
  
  /**
   * 执行节点
   * 
   * 设置节点状态为 RUNNING，调用 run() 方法执行具体逻辑
   * 执行完成后设置状态为 COMPLETED，如果出错则设置为 FAILED
   * 
   * @param {NodeContext} context - 执行上下文
   * @returns {Promise<void>} 执行完成的 Promise
   * @throws {Error} 如果执行失败会抛出错误
   * 
   * @example
   * ```typescript
   * const context = createContext(node);
   * await node.execute(context);
   * ```
   */
  async execute(context: NodeContext): Promise<void> {
    this.abortController = new AbortController();
    this.state = NodeState.RUNNING;
    
    try {
      await this.run(context);
      this.state = NodeState.COMPLETED;
    } catch (error) {
      this.state = NodeState.FAILED;
      throw error;
    } finally {
      this.abortController = null;
    }
  }
  
  /**
   * 取消节点执行
   * 
   * 发送取消信号并设置节点状态为 CANCELLED
   * 
   * @returns {void}
   * 
   * @example
   * ```typescript
   * node.cancel(); // 取消节点执行
   * ```
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.state = NodeState.CANCELLED;
  }
  
  /**
   * 子类实现具体的执行逻辑
   * 
   * 此方法由 execute() 调用，子类必须实现此方法
   * 
   * @protected
   * @abstract
   * @param {NodeContext} context - 执行上下文
   * @returns {Promise<void>} 执行完成的 Promise
   * 
   * @example
   * ```typescript
   * protected async run(context: NodeContext): Promise<void> {
   *   const input = context.getInput('in');
   *   const result = await processData(input);
   *   await context.setOutput('out', result);
   * }
   * ```
   */
  protected abstract run(context: NodeContext): Promise<void>;
}

