/**
 * 类型安全的比较器接口。
 * comparator(a, b) 的返回值应遵循：
 * - 负数: a 的优先级高于 b (a 应该在堆中更靠近顶部)
 * - 零: a 和 b 优先级相同
 * - 正数: b 的优先级高于 a (b 应该在堆中更靠近顶部)
 * * 对于 Min-Heap (最小堆)，可以实现 (a, b) => a - b。
 * 对于 Max-Heap (最大堆)，可以实现 (a, b) => b - a。
 */
export type Comparator<K> = (a: K, b: K) => number;

/**
 * 配对堆节点结构
 * PairingNode<T> 内部包含实际存储的数据 T。
 * 配对堆的节点是一个多叉树结构。
 */
export class PairingNode<T> {
  public value: T;

  public first_child: PairingNode<T> | null = null;
  public next_sibling: PairingNode<T> | null = null;

  /**
   * 【前驱连接】实现 O(1) 剪切的核心指针。
   * - 如果是第一个孩子，指向父节点 (Parent)。
   * - 否则，指向上一个兄弟节点 (Previous Sibling)。
   */
  public prev_link: PairingNode<T> | null = null;

  public constructor(value: T) {
    this.value = value;
  }
}

export class PairingHeap<T> {
  readonly #comparator: Comparator<T>;
  #root: PairingNode<T> | null = null;

  public constructor(comparator: Comparator<T>) {
    this.#comparator = comparator;
  }

  public peek(): T | undefined {
    return this.#root?.value;
  }

  public insert(value: T): PairingNode<T> {
    const node = new PairingNode(value);
    this.#root = this.#root === null
      ? node
      : this.#meld(this.#root, node);
    return node;
  }

  public poll() {
    if (!this.#root) return null;

    const value = this.#root.value
    if (!this.#root.first_child) {
      this.#root = null;
      return value;
    }
  }

  #meld(a: PairingNode<T>, b: PairingNode<T>): PairingNode<T> {
    if (this.#comparator(a.value, b.value) <= 0) {
      b.next_sibling = a.first_child;
      if (a.first_child)
        a.first_child.prev_link = b;

      b.prev_link = a;
      a.first_child = b;
      return a;
    }

    a.next_sibling = b.first_child;
    if (b.first_child) {
      b.first_child.prev_link = a;
    }

    a.prev_link = b;
    b.first_child = a;
    return b;
  }

  #merge_pairs(head: PairingNode<T> | null): PairingNode<T> | null {
    if (head === null || head.next_sibling === null) {
      return head;
    }

    let current: PairingNode<T> = head;
    let next: PairingNode<T> | null;

    const merged_list: PairingNode<T>[] = [];

    while (current !== null) {
      next = current.next_sibling;

      current.prev_link = current.next_sibling = null;

      if (next === null) {
        merged_list.push(current);
        break;
      }

      next.prev_link = next.next_sibling = null;

      current = this.#meld(current, next);
      merged_list.push(current);

      current = next.next_sibling!;
    }

    if (merged_list.length === 0) {
      return null;
    }

    let result_root = merged_list[merged_list.length - 1];

    for (let i = merged_list.length - 2; i >= 0; i--) {
      result_root = this.#meld(result_root, merged_list[i]);
    }

    return result_root;
  }
}