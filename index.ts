export type Comparator<T> = (a: T, b: T) => number;

export class PairingNode<T> {
  public value: T;

  public first_child: PairingNode<T> | null = null;
  public next_sibling: PairingNode<T> | null = null;

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

  public poll(): T | null {
    if (!this.#root) return null;

    const value = this.#root.value
    const first_child = this.#root.first_child;

    this.#root.first_child = null;
    if (first_child) first_child.prev_link = null;

    this.#root = this.#merge_pairs(first_child);
    return value;
  }

  public insert(value: T): PairingNode<T> {
    const node = new PairingNode(value);
    this.#root = this.#root ? this.#meld(this.#root, node) : node;
    return node;
  }

  public decrease(node: PairingNode<T>, value: T) {
    if (this.#comparator(value, node.value) > 0)
      throw new Error("New value does not represent a higher priority (lower key).");

    node.value = value;
    if (node === this.#root) return

    this.#cut_node(node);

    this.#root = this.#meld(this.#root!, node);
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

    const merged_pairs: PairingNode<T>[] = [];
    let current: PairingNode<T> | null = head;

    while (current) {
      let next: PairingNode<T> | null = current.next_sibling;
      current.prev_link = current.next_sibling = null;

      if (next === null) {
        merged_pairs.push(current);
        current = null;
      } else {
        const next_pair_start: PairingNode<T> | null = next.next_sibling;
        next.prev_link = next.next_sibling = null;

        const merged = this.#meld(current, next);
        merged_pairs.push(merged);

        current = next_pair_start
      }
    }

    if (merged_pairs.length === 0) return null;

    let result_root = merged_pairs.pop()!;
    while (merged_pairs.length > 0) {
      result_root = this.#meld(result_root, merged_pairs.pop()!);
    }

    return result_root;
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
  }
}