export type Comparator<T> = (a: T, b: T) => number;

export class PairingNode<T> {
  public value: T;

  public first_child: PairingNode<T> | null = null;
  public next_sibling: PairingNode<T> | null = null;

  public prev_link: PairingNode<T> | null = null;

  public rank: number = 0;

  public constructor(value: T) {
    this.value = value;
  }
}

export class PairingHeap<T> {
  readonly #comparator: Comparator<T>;
  #root: PairingNode<T> | null = null;
  #size: number = 0;

  public constructor(comparator: Comparator<T>) {
    this.#comparator = comparator;
  }

  public peek(): T | undefined {
    return this.#root?.value;
  }

  public size(): number {
    return this.#size;
  }

  public isEmpty(): boolean {
    return this.#size === 0;
  }

  public clear(): void {
    this.#root = null;
    this.#size = 0;
  }

  public poll(): T | null {
    if (!this.#root) return null;

    const value = this.#root.value
    const first_child = this.#root.first_child;

    this.#root.first_child = null;
    this.#root.rank = 0;
    if (first_child) first_child.prev_link = null;

    this.#root = this.#merge_pairs(first_child);
    this.#size--;
    return value;
  }

  public insert(value: T): PairingNode<T> {
    const node = new PairingNode(value);
    this.#root = this.#root ? this.#meld(this.#root, node) : node;
    this.#size++;
    return node;
  }

  public insertBatch(values: T[]): PairingNode<T>[] {
    const nodes: PairingNode<T>[] = [];
    for (const value of values) {
      nodes.push(this.insert(value));
    }
    return nodes;
  }

  public decrease(node: PairingNode<T>, value: T) {
    if (this.#comparator(value, node.value) > 0)
      throw new Error("New value does not represent a higher priority (lower key).");

    node.value = value;
    if (node === this.#root) return

    this.#cut_node(node);

    this.#root = this.#meld(this.#root!, node);
  }

  public decreaseBatch(updates: Array<{ node: PairingNode<T>, value: T }>): void {
    for (const { node, value } of updates) {
      this.decrease(node, value);
    }
  }

  public delete(node: PairingNode<T>): void {
    if (!this.#root || !node) return;

    if (node === this.#root) {
      this.poll();
      return;
    }

    this.#cut_node(node);

    const children_root = this.#merge_pairs(node.first_child);
    node.first_child = null;

    if (children_root) this.#root = this.#meld(this.#root!, children_root);
    this.#size--;
  }

  #meld(a: PairingNode<T>, b: PairingNode<T>): PairingNode<T> {
    if (this.#comparator(a.value, b.value) <= 0) {
      b.next_sibling = a.first_child;
      if (a.first_child) a.first_child.prev_link = b;

      b.prev_link = a;
      a.first_child = b;
      return a;
    }

    a.next_sibling = b.first_child;
    if (b.first_child) b.first_child.prev_link = a;

    a.prev_link = b;
    b.first_child = a;
    return b;
  }

  #merge_pairs(head: PairingNode<T> | null): PairingNode<T> | null {
    if (head === null) return null;
    if (head.next_sibling === null) return head;

    // First pass: pair up adjacent siblings and merge them from left to right
    let pairs: PairingNode<T>[] = [];
    let current: PairingNode<T> | null = head;

    while (current !== null) {
      const first = current;
      const second: PairingNode<T> | null = current.next_sibling;

      // Clear links
      first.prev_link = null;
      first.next_sibling = null;

      if (second !== null) {
        const next = second.next_sibling;
        second.prev_link = null;
        second.next_sibling = null;

        // Merge the pair
        pairs.push(this.#meld(first, second));
        current = next;
      } else {
        // Odd number of nodes, last one stands alone
        pairs.push(first);
        current = null;
      }
    }

    // Second pass: merge all pairs from right to left
    let result = pairs[pairs.length - 1];
    for (let i = pairs.length - 2; i >= 0; i--) {
      result = this.#meld(pairs[i], result);
    }

    return result;
  }

  #cut_node(node: PairingNode<T>): void {
    const prev_link = node.prev_link;

    if (prev_link) {
      if (prev_link.first_child === node) {
        prev_link.first_child = node.next_sibling;
      } else {
        prev_link.next_sibling = node.next_sibling;
      }
    }

    if (node.next_sibling) node.next_sibling.prev_link = prev_link;

    node.prev_link = null;
    node.next_sibling = null;
    node.rank = 0;
  }

  public *[Symbol.iterator](): IterableIterator<T> {
    if (!this.#root) return;

    // Perform a level-order traversal without modifying the heap
    const queue: PairingNode<T>[] = [this.#root];

    while (queue.length > 0) {
      const node = queue.shift()!;
      yield node.value;

      // Add children to queue
      let child = node.first_child;
      while (child) {
        queue.push(child);
        child = child.next_sibling;
      }
    }
  }

  public toArray(): T[] {
    return Array.from(this);
  }

  public merge(other: PairingHeap<T>): void {
    if (!other.#root) return;
    
    if (!this.#root) {
      this.#root = other.#root;
      this.#size = other.#size;
    } else {
      this.#root = this.#meld(this.#root, other.#root);
      this.#size += other.#size;
    }

    // Clear the other heap
    other.#root = null;
    other.#size = 0;
  }

  public static fromDAG<T>(
    nodes: T[],
    getInDegree: (node: T) => number,
    comparator?: Comparator<T>
  ): PairingHeap<T> {
    // Default comparator: compare by in-degree
    const comp = comparator || ((a: T, b: T) => getInDegree(a) - getInDegree(b));
    const heap = new PairingHeap<T>(comp);
    heap.insertBatch(nodes);
    return heap;
  }
}
