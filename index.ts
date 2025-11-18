// @ts-nocheck
// SmoothHeap.js  ——  ES Module 版本（高性能工程实现）

class SmoothHeapNode {
  constructor(key = null, value = null) {
    this.key = key;
    this.value = value;

    this.parent = null;
    this.child = null;

    // sibling double linked list
    this.sibling = null;
    this.prevSibling = null;
  }

  detachFromSiblings() {
    if (this.prevSibling) {
      this.prevSibling.sibling = this.sibling;
    }
    if (this.sibling) {
      this.sibling.prevSibling = this.prevSibling;
    }
    this.sibling = null;
    this.prevSibling = null;
  }

  linkChildAsFirst(other) {
    if (!other) return;
    other.parent = this;
    other.prevSibling = null;
    other.sibling = this.child;
    if (this.child) this.child.prevSibling = other;
    this.child = other;
  }

  clearPointers() {
    this.parent = null;
    this.child = null;
    this.sibling = null;
    this.prevSibling = null;
    this.key = null;
    this.value = null;
  }
}

class SmoothHeap {
  constructor(comparator = null, usePool = true) {
    if (comparator && typeof comparator !== 'function') {
      throw new TypeError('comparator 必须是函数或 null');
    }

    this._cmp = comparator || ((a, b) => {
      if (a === b) return 0;
      return a < b ? -1 : 1;
    });

    this.root = null;
    this._size = 0;

    this._usePool = Boolean(usePool);
    this._pool = [];
  }

  isEmpty() { return this.root === null; }
  size() { return this._size; }

  _allocNode(key, value) {
    let n;
    if (this._usePool && this._pool.length) {
      n = this._pool.pop();
      n.key = key;
      n.value = value;
    } else {
      n = new SmoothHeapNode(key, value);
    }
    return n;
  }

  _freeNode(node) {
    if (!node) return;
    node.clearPointers();
    if (this._usePool) this._pool.push(node);
  }

  _less(a, b) {
    return this._cmp(a, b) < 0;
  }

  static _meldNodes(a, b, cmp) {
    if (!a) return b;
    if (!b) return a;

    if (cmp(a.key, b.key) <= 0) {
      b.parent = a;
      b.prevSibling = null;
      b.sibling = a.child;
      if (a.child) a.child.prevSibling = b;
      a.child = b;
      return a;
    } else {
      a.parent = b;
      a.prevSibling = null;
      a.sibling = b.child;
      if (b.child) b.child.prevSibling = a;
      b.child = a;
      return b;
    }
  }

  insert(key, value = null) {
    const node = this._allocNode(key, value);
    node.parent = node.child =
      node.sibling = node.prevSibling = null;

    this.root = SmoothHeap._meldNodes(this.root, node, this._cmp);
    this._size++;
    return node;
  }

  findMin() {
    if (!this.root) return null;
    return { key: this.root.key, value: this.root.value };
  }

  merge(other) {
    if (!(other instanceof SmoothHeap)) {
      throw new TypeError('merge 需要另一个 SmoothHeap');
    }
    if (other === this) return;

    this.root = SmoothHeap._meldNodes(this.root, other.root, this._cmp);
    this._size += other._size;

    other.root = null;
    other._size = 0;
    other._pool.length = 0;
  }

  decreaseKey(node, newKey) {
    if (!node) throw new TypeError('需要 node');
    if (this._cmp(newKey, node.key) > 0) {
      throw new Error('newKey 必须 <= 当前 key');
    }

    node.key = newKey;

    if (node === this.root) return;

    const p = node.parent;
    if (p) {
      if (p.child === node) {
        p.child = node.sibling;
        if (node.sibling) node.sibling.prevSibling = null;
      } else {
        node.detachFromSiblings();
      }
      node.parent = null;
    } else {
      node.detachFromSiblings();
    }

    node.sibling = node.prevSibling = null;
    this.root = SmoothHeap._meldNodes(this.root, node, this._cmp);
  }

  delete(node) {
    if (!node) return;

    // cut node to root
    if (node !== this.root) {
      const p = node.parent;
      if (p) {
        if (p.child === node) {
          p.child = node.sibling;
          if (node.sibling) node.sibling.prevSibling = null;
        } else node.detachFromSiblings();
        node.parent = null;
      } else node.detachFromSiblings();

      node.sibling = node.prevSibling = null;
      this.root = SmoothHeap._meldNodes(this.root, node, this._cmp);
    }

    // try decreaseKey to smallest
    if (typeof node.key === 'number') {
      this.decreaseKey(node, Number.NEGATIVE_INFINITY);
    } else {
      try {
        this.decreaseKey(node, this.root.key);
      } catch (_) {}
    }

    return this.deleteMin();
  }

  deleteMin() {
    if (!this.root) return null;

    const oldRoot = this.root;
    const ret = { key: oldRoot.key, value: oldRoot.value };

    const firstChild = oldRoot.child;

    oldRoot.child = oldRoot.parent = null;
    oldRoot.sibling = oldRoot.prevSibling = null;

    if (!firstChild) {
      this.root = null;
      this._size--;
      this._freeNode(oldRoot);
      return ret;
    }

    let iter = firstChild;
    while (iter) {
      iter.parent = null;
      iter = iter.sibling;
    }

    const stack = [];
    let cur = firstChild;
    while (cur) {
      const a = cur;
      const b = cur.sibling;
      if (!b) {
        a.prevSibling = null;
        a.sibling = null;
        stack.push(a);
        break;
      }

      const next = b.sibling;

      a.prevSibling = null;
      a.sibling = null;
      b.prevSibling = null;
      b.sibling = null;

      if (this._cmp(a.key, b.key) <= 0) {
        b.parent = a;
        b.prevSibling = null;
        b.sibling = a.child;
        if (a.child) a.child.prevSibling = b;
        a.child = b;
        stack.push(a);
      } else {
        a.parent = b;
        a.prevSibling = null;
        a.sibling = b.child;
        if (b.child) b.child.prevSibling = a;
        b.child = a;
        stack.push(b);
      }

      cur = next;
    }

    let newRoot = stack.length ? stack.pop() : null;
    while (stack.length) {
      const t = stack.pop();
      newRoot = SmoothHeap._meldNodes(t, newRoot, this._cmp);
    }

    this.root = newRoot;
    if (this.root) this.root.parent = null;

    this._size--;
    this._freeNode(oldRoot);

    return ret;
  }

  toArray() {
    const out = [];
    if (!this.root) return out;

    const stack = [this.root];
    while (stack.length) {
      const n = stack.pop();
      out.push({ key: n.key, value: n.value });
      let c = n.child;
      while (c) {
        stack.push(c);
        c = c.sibling;
      }
    }
    return out;
  }

  debugString() {
    if (!this.root) return '<empty>';
    const lines = [];
    const walk = (node, depth = 0) => {
      const pad = '  '.repeat(depth);
      lines.push(`${pad}- (${node.key}) ${String(node.value)}`);
      let c = node.child;
      while (c) {
        walk(c, depth + 1);
        c = c.sibling;
      }
    };
    walk(this.root, 0);
    return lines.join('\n');
  }
}


const heap = new SmoothHeap();

// 插入一些元素
const n1 = heap.insert(10, 'task-10');
const n2 = heap.insert(3,  'task-3');
const n3 = heap.insert(7,  'task-7');
const n4 = heap.insert(15, 'task-15');
const n5 = heap.insert(8,  'task-8');

console.log('当前最小值:', heap.findMin()); 
// => { key: 3, value: 'task-3' }

// decreaseKey：把 key 7 改成 key 1
heap.decreaseKey(n3, 1);
console.log('执行 decreaseKey 后的最小值:', heap.findMin());
// => { key: 1, value: 'task-7' }

console.log('\n当前堆结构:\n' + heap.debugString());

// 删除最小
const removedMin = heap.deleteMin();
console.log('\n删除最小:', removedMin.key, removedMin.value);

console.log('\n现在的堆结构:\n' + heap.debugString());

// 删除任意节点，例如 n1 (key=10)
console.log('\n删除节点 n1:', heap.delete(n1));

console.log('\n删除 n1 后堆结构:\n' + heap.debugString());

// 演示 merge：创建第二个堆
const heap2 = new SmoothHeap();
heap2.insert(2, 'from-heap2');
heap2.insert(50, 'another');

heap.merge(heap2);
console.log('\n合并 heap2 后最小值:', heap.findMin());
console.log('\n合并后堆结构:\n' + heap.debugString());

// 示例：使用自定义比较器（字符串长度排序）
const heap3 = new SmoothHeap((a, b) => a.length - b.length);

heap3.insert('banana');
heap3.insert('kiwi');
heap3.insert('dragonfruit');
heap3.insert('fig');

console.log('\n字符串长度最小:', heap3.findMin());
// => 'fig'

console.log('\n字符串堆结构:\n' + heap3.debugString());