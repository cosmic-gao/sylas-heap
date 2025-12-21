/**
 * 端点模块
 * 
 * 提供图调度系统中节点输入/输出端点的实现
 * 支持 PUSH 和 PULL 两种数据流模式
 */

/**
 * 数据流模式枚举
 * 
 * @enum {string}
 * @readonly
 */
export enum DataFlowMode {
  /** 生产者推送数据模式 - 数据由上游节点主动推送到下游 */
  PUSH = 'push',
  /** 消费者拉取数据模式 - 数据由下游节点主动从上游拉取 */
  PULL = 'pull',
}

/**
 * 端点类型枚举
 * 
 * @enum {string}
 * @readonly
 */
export enum EndpointType {
  /** 输入端点 - 接收来自其他节点的数据 */
  INPUT = 'input',
  /** 输出端点 - 向其他节点发送数据 */
  OUTPUT = 'output',
}

/**
 * 端点接口
 * 
 * 定义了端点的基本行为和属性
 * 
 * @template T 端点传输的数据类型，默认为 any
 * 
 * @interface
 */
export interface IEndpoint<T = any> {
  /** 端点的唯一标识符 */
  readonly id: string;
  /** 端点类型（输入或输出） */
  readonly type: EndpointType;
  /** 端点所属的节点 */
  readonly node: any; // 使用 any 避免循环依赖，实际类型为 INode
  /** 数据流模式（PUSH 或 PULL） */
  readonly dataFlowMode: DataFlowMode;
  
  /**
   * 获取连接到该端点的所有边
   * 
   * @returns {Edge<T>[]} 边的数组，如果没有连接则返回空数组
   */
  getEdges(): any[]; // 使用 any 避免循环依赖，实际类型为 Edge<T>[]
  
  /**
   * 检查是否可以连接到另一个端点
   * 
   * @param {IEndpoint<T>} other - 要检查的另一个端点
   * @returns {boolean} 如果可以连接返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * const inputEp = node.getInputEndpoint('in');
   * const outputEp = otherNode.getOutputEndpoint('out');
   * if (inputEp.canConnect(outputEp)) {
   *   // 可以连接
   * }
   * ```
   */
  canConnect(other: IEndpoint<T>): boolean;
  
  /**
   * 推送数据到端点
   * 
   * @param {T} data - 要推送的数据
   * @returns {Promise<void>} 推送完成的 Promise
   * @throws {Error} 如果端点不支持 PUSH 模式会抛出错误
   * 
   * @example
   * ```typescript
   * await endpoint.pushData({ value: 100 });
   * ```
   */
  pushData(data: T): Promise<void>;
  
  /**
   * 从端点拉取数据
   * 
   * @returns {Promise<T | undefined>} 拉取到的数据，如果没有数据则返回 undefined
   * @throws {Error} 如果端点不支持 PULL 模式会抛出错误
   * 
   * @example
   * ```typescript
   * const data = await endpoint.pullData();
   * if (data !== undefined) {
   *   console.log('收到数据:', data);
   * }
   * ```
   */
  pullData(): Promise<T | undefined>;
  
  /**
   * 检查端点是否有可用数据
   * 
   * @returns {boolean} 如果有数据返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * if (endpoint.hasData()) {
   *   const data = await endpoint.pullData();
   * }
   * ```
   */
  hasData(): boolean;
}

/**
 * 输入端点类
 * 
 * 实现节点的输入接口，负责接收来自其他节点的数据
 * 
 * @template T 端点传输的数据类型，默认为 any
 * @implements {IEndpoint<T>}
 * 
 * @example
 * ```typescript
 * const inputEp = new InputEndpoint('input1', node, DataFlowMode.PUSH);
 * await inputEp.pushData({ value: 100 });
 * const data = await inputEp.pullData();
 * ```
 */
export class InputEndpoint<T = any> implements IEndpoint<T> {
  /** 端点的唯一标识符 */
  readonly id: string;
  /** 端点类型，始终为 INPUT */
  readonly type = EndpointType.INPUT;
  /** 端点所属的节点 */
  readonly node: any; // 使用 any 避免循环依赖
  /** 数据流模式 */
  readonly dataFlowMode: DataFlowMode;
  
  /** 连接到该端点的所有边 */
  private edges: any[] = []; // 使用 any 避免循环依赖
  /** 数据队列 - 存储接收到的数据 */
  private dataQueue: T[] = [];
  /** 等待数据的 Promise 解析器数组 */
  private dataPromises: Array<(data: T) => void> = [];
  
  /**
   * 创建输入端点实例
   * 
   * @param {string} id - 端点的唯一标识符
   * @param {any} node - 端点所属的节点
   * @param {DataFlowMode} dataFlowMode - 数据流模式，默认为 PUSH
   * 
   * @example
   * ```typescript
   * const endpoint = new InputEndpoint('input1', myNode, DataFlowMode.PUSH);
   * ```
   */
  constructor(id: string, node: any, dataFlowMode: DataFlowMode = DataFlowMode.PUSH) {
    this.id = id;
    this.node = node;
    this.dataFlowMode = dataFlowMode;
  }
  
  /**
   * 获取连接到该端点的所有边
   * 
   * @returns {any[]} 边的数组副本，防止外部修改内部状态
   * 
   * @example
   * ```typescript
   * const edges = inputEp.getEdges();
   * console.log(`连接到 ${edges.length} 个上游节点`);
   * ```
   */
  getEdges(): any[] {
    return [...this.edges];
  }
  
  /**
   * 添加连接到该端点的边
   * 
   * 内部方法，由 Graph.connect() 调用
   * 
   * @param {any} edge - 要添加的边
   * @returns {void}
   * 
   * @internal
   */
  addEdge(edge: any): void {
    if (!this.edges.includes(edge)) {
      this.edges.push(edge);
    }
  }
  
  /**
   * 移除连接到该端点的边
   * 
   * 内部方法，由 Graph.removeEdge() 调用
   * 
   * @param {any} edge - 要移除的边
   * @returns {void}
   * 
   * @internal
   */
  removeEdge(edge: any): void {
    const index = this.edges.indexOf(edge);
    if (index !== -1) {
      this.edges.splice(index, 1);
    }
  }
  
  /**
   * 检查是否可以连接到另一个端点
   * 
   * 输入端点只能连接到输出端点
   * 
   * @param {IEndpoint<T>} other - 要检查的另一个端点
   * @returns {boolean} 如果 other 是输出端点返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * const canConnect = inputEp.canConnect(outputEp); // true
   * const cannotConnect = inputEp.canConnect(anotherInputEp); // false
   * ```
   */
  canConnect(other: IEndpoint<T>): boolean {
    return other.type === EndpointType.OUTPUT;
  }
  
  /**
   * 推送数据到端点（PUSH 模式）
   * 
   * 在 PUSH 模式下，上游节点会调用此方法推送数据
   * 如果有等待的 Promise，会立即解析；否则将数据加入队列
   * 
   * @param {T} data - 要推送的数据
   * @returns {Promise<void>} 推送完成的 Promise
   * @throws {Error} 如果端点不是 PUSH 模式会抛出错误
   * 
   * @example
   * ```typescript
   * // PUSH 模式下接收数据
   * await inputEp.pushData({ value: 100 });
   * ```
   */
  async pushData(data: T): Promise<void> {
    if (this.dataFlowMode !== DataFlowMode.PUSH) {
      throw new Error(`Endpoint ${this.id} is not in PUSH mode`);
    }
    
    // 如果有等待的 promise,立即解决
    const resolver = this.dataPromises.shift();
    if (resolver) {
      resolver(data);
    } else {
      this.dataQueue.push(data);
    }
  }
  
  /**
   * 从端点拉取数据
   * 
   * - PUSH 模式：从内部队列中获取数据
   * - PULL 模式：从上游端点拉取数据
   * 
   * @returns {Promise<T | undefined>} 拉取到的数据，如果没有数据则返回 undefined
   * 
   * @example
   * ```typescript
   * // PUSH 模式：从队列获取
   * const data1 = await inputEp.pullData();
   * 
   * // PULL 模式：从上游拉取
   * const data2 = await inputEp.pullData();
   * ```
   */
  async pullData(): Promise<T | undefined> {
    if (this.dataFlowMode === DataFlowMode.PUSH) {
      // PUSH 模式下从队列获取
      return this.dataQueue.shift();
    } else {
      // PULL 模式下从上游拉取
      for (const edge of this.edges) {
        const data = await edge.source.pullData();
        if (data !== undefined) {
          return data;
        }
      }
      return undefined;
    }
  }
  
  /**
   * 检查端点是否有可用数据
   * 
   * 仅检查内部队列，不检查上游端点
   * 
   * @returns {boolean} 如果队列中有数据返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * if (inputEp.hasData()) {
   *   const data = await inputEp.pullData();
   * }
   * ```
   */
  hasData(): boolean {
    return this.dataQueue.length > 0;
  }
  
  /**
   * 等待数据到达（异步等待）
   * 
   * 如果队列中已有数据，立即返回；否则返回一个 Promise，等待数据到达
   * 
   * @returns {Promise<T>} 数据到达时解析的 Promise
   * 
   * @example
   * ```typescript
   * // 等待数据到达
   * const data = await inputEp.waitForData();
   * console.log('收到数据:', data);
   * ```
   */
  waitForData(): Promise<T> {
    if (this.dataQueue.length > 0) {
      return Promise.resolve(this.dataQueue.shift()!);
    }
    
    return new Promise((resolve) => {
      this.dataPromises.push(resolve);
    });
  }
  
  /**
   * 清空端点的所有数据和等待的 Promise
   * 
   * 用于重置端点状态
   * 
   * @returns {void}
   * 
   * @example
   * ```typescript
   * inputEp.clear(); // 清空所有数据
   * ```
   */
  clear(): void {
    this.dataQueue = [];
    this.dataPromises = [];
  }
}

/**
 * 输出端点类
 * 
 * 实现节点的输出接口，负责向其他节点发送数据
 * 
 * @template T 端点传输的数据类型，默认为 any
 * @implements {IEndpoint<T>}
 * 
 * @example
 * ```typescript
 * const outputEp = new OutputEndpoint('output1', node, DataFlowMode.PUSH);
 * await outputEp.pushData({ value: 100 });
 * ```
 */
export class OutputEndpoint<T = any> implements IEndpoint<T> {
  /** 端点的唯一标识符 */
  readonly id: string;
  /** 端点类型，始终为 OUTPUT */
  readonly type = EndpointType.OUTPUT;
  /** 端点所属的节点 */
  readonly node: any; // 使用 any 避免循环依赖
  /** 数据流模式 */
  readonly dataFlowMode: DataFlowMode;
  
  /** 连接到该端点的所有边 */
  private edges: any[] = []; // 使用 any 避免循环依赖
  /** 数据队列 - 在 PULL 模式下存储数据 */
  private dataQueue: T[] = [];
  
  /**
   * 创建输出端点实例
   * 
   * @param {string} id - 端点的唯一标识符
   * @param {any} node - 端点所属的节点
   * @param {DataFlowMode} dataFlowMode - 数据流模式，默认为 PUSH
   * 
   * @example
   * ```typescript
   * const endpoint = new OutputEndpoint('output1', myNode, DataFlowMode.PUSH);
   * ```
   */
  constructor(id: string, node: any, dataFlowMode: DataFlowMode = DataFlowMode.PUSH) {
    this.id = id;
    this.node = node;
    this.dataFlowMode = dataFlowMode;
  }
  
  /**
   * 获取连接到该端点的所有边
   * 
   * @returns {any[]} 边的数组副本，防止外部修改内部状态
   * 
   * @example
   * ```typescript
   * const edges = outputEp.getEdges();
   * console.log(`连接到 ${edges.length} 个下游节点`);
   * ```
   */
  getEdges(): any[] {
    return [...this.edges];
  }
  
  /**
   * 添加连接到该端点的边
   * 
   * 内部方法，由 Graph.connect() 调用
   * 
   * @param {any} edge - 要添加的边
   * @returns {void}
   * 
   * @internal
   */
  addEdge(edge: any): void {
    if (!this.edges.includes(edge)) {
      this.edges.push(edge);
    }
  }
  
  /**
   * 移除连接到该端点的边
   * 
   * 内部方法，由 Graph.removeEdge() 调用
   * 
   * @param {any} edge - 要移除的边
   * @returns {void}
   * 
   * @internal
   */
  removeEdge(edge: any): void {
    const index = this.edges.indexOf(edge);
    if (index !== -1) {
      this.edges.splice(index, 1);
    }
  }
  
  /**
   * 检查是否可以连接到另一个端点
   * 
   * 输出端点只能连接到输入端点
   * 
   * @param {IEndpoint<T>} other - 要检查的另一个端点
   * @returns {boolean} 如果 other 是输入端点返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * const canConnect = outputEp.canConnect(inputEp); // true
   * const cannotConnect = outputEp.canConnect(anotherOutputEp); // false
   * ```
   */
  canConnect(other: IEndpoint<T>): boolean {
    return other.type === EndpointType.INPUT;
  }
  
  /**
   * 推送数据到端点
   * 
   * - PUSH 模式：立即推送到所有下游端点
   * - PULL 模式：将数据存储到队列中，等待下游拉取
   * 
   * @param {T} data - 要推送的数据
   * @returns {Promise<void>} 推送完成的 Promise
   * 
   * @example
   * ```typescript
   * // PUSH 模式：立即推送到所有下游
   * await outputEp.pushData({ value: 100 });
   * 
   * // PULL 模式：存储数据等待拉取
   * await outputEp.pushData({ value: 100 });
   * ```
   */
  async pushData(data: T): Promise<void> {
    if (this.dataFlowMode === DataFlowMode.PUSH) {
      // PUSH 模式:推送到所有下游
      await Promise.all(
        this.edges.map(edge => edge.target.pushData(data))
      );
    } else {
      // PULL 模式:存储数据等待拉取
      this.dataQueue.push(data);
    }
  }
  
  /**
   * 从端点拉取数据（PULL 模式）
   * 
   * 仅在 PULL 模式下有效，从内部队列中获取数据
   * 
   * @returns {Promise<T | undefined>} 拉取到的数据，如果没有数据则返回 undefined
   * @throws {Error} 如果端点不是 PULL 模式会抛出错误
   * 
   * @example
   * ```typescript
   * // PULL 模式下拉取数据
   * const data = await outputEp.pullData();
   * ```
   */
  async pullData(): Promise<T | undefined> {
    if (this.dataFlowMode !== DataFlowMode.PULL) {
      throw new Error(`Endpoint ${this.id} is not in PULL mode`);
    }
    return this.dataQueue.shift();
  }
  
  /**
   * 检查端点是否有可用数据
   * 
   * 仅检查内部队列（PULL 模式）
   * 
   * @returns {boolean} 如果队列中有数据返回 true，否则返回 false
   * 
   * @example
   * ```typescript
   * if (outputEp.hasData()) {
   *   const data = await outputEp.pullData();
   * }
   * ```
   */
  hasData(): boolean {
    return this.dataQueue.length > 0;
  }
  
  /**
   * 清空端点的所有数据
   * 
   * 用于重置端点状态
   * 
   * @returns {void}
   * 
   * @example
   * ```typescript
   * outputEp.clear(); // 清空所有数据
   * ```
   */
  clear(): void {
    this.dataQueue = [];
  }
}

