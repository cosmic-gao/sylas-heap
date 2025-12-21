/**
 * 边模块
 * 
 * 提供图调度系统中边的实现
 * 边连接输出端点和输入端点，形成数据流通道
 */

import { OutputEndpoint, InputEndpoint } from './Endpoint';

/**
 * 边类
 * 
 * 连接输出端点和输入端点，形成数据流通道
 * 边是单向的，数据从 source 流向 target
 * 
 * @template T 边传输的数据类型，默认为 any
 * 
 * @example
 * ```typescript
 * const edge = new Edge('edge1', outputEp, inputEp);
 * await edge.transferData({ value: 100 });
 * ```
 */
export class Edge<T = any> {
  /** 边的唯一标识符 */
  readonly id: string;
  /** 源端点（输出端点） */
  readonly source: OutputEndpoint<T>;
  /** 目标端点（输入端点） */
  readonly target: InputEndpoint<T>;
  
  /**
   * 创建边实例
   * 
   * @param {string} id - 边的唯一标识符
   * @param {OutputEndpoint<T>} source - 源端点（输出端点）
   * @param {InputEndpoint<T>} target - 目标端点（输入端点）
   * 
   * @example
   * ```typescript
   * const edge = new Edge('edge1', outputEp, inputEp);
   * ```
   */
  constructor(id: string, source: OutputEndpoint<T>, target: InputEndpoint<T>) {
    this.id = id;
    this.source = source;
    this.target = target;
  }
  
  /**
   * 传输数据通过边
   * 
   * 将数据从源端点传输到目标端点
   * 
   * @param {T} data - 要传输的数据
   * @returns {Promise<void>} 传输完成的 Promise
   * 
   * @example
   * ```typescript
   * await edge.transferData({ value: 100 });
   * ```
   */
  async transferData(data: T): Promise<void> {
    await this.target.pushData(data);
  }
}

