import { Graph, INode, NodeState } from './graph';

/**
 * 图可视化工具
 * 将图结构转换为文本表示,便于调试和理解
 */
export class GraphVisualizer {
  /**
   * 生成 ASCII 艺术风格的图表示
   */
  static toASCII(graph: Graph): string {
    const stats = graph.getStats();
    const lines: string[] = [];
    
    lines.push('┌─────────────────────────────────────────┐');
    lines.push('│          图调度系统状态                 │');
    lines.push('├─────────────────────────────────────────┤');
    lines.push(`│ 总节点数: ${stats.totalNodes.toString().padEnd(28)} │`);
    lines.push(`│ 总边数:   ${stats.totalEdges.toString().padEnd(28)} │`);
    lines.push(`│ 运行中:   ${stats.runningNodes.toString().padEnd(28)} │`);
    lines.push(`│ 就绪:     ${stats.readyNodes.toString().padEnd(28)} │`);
    lines.push('├─────────────────────────────────────────┤');
    lines.push('│ 状态分布:                               │');
    lines.push(`│   PENDING:    ${stats.states.pending.toString().padEnd(24)} │`);
    lines.push(`│   READY:      ${stats.states.ready.toString().padEnd(24)} │`);
    lines.push(`│   RUNNING:    ${stats.states.running.toString().padEnd(24)} │`);
    lines.push(`│   COMPLETED:  ${stats.states.completed.toString().padEnd(24)} │`);
    lines.push(`│   FAILED:     ${stats.states.failed.toString().padEnd(24)} │`);
    lines.push(`│   CANCELLED:  ${stats.states.cancelled.toString().padEnd(24)} │`);
    lines.push('└─────────────────────────────────────────┘');
    
    return lines.join('\n');
  }
  
  /**
   * 生成 Mermaid 流程图代码
   * 可以在 Mermaid Live Editor 中查看: https://mermaid.live
   */
  static toMermaid(nodes: INode[], edges: Array<{ from: string; to: string }>): string {
    const lines: string[] = ['graph TD'];
    
    // 添加节点
    for (const node of nodes) {
      const style = this.getNodeStyle(node.state);
      const label = `${node.id}[${node.id}\\nP:${node.priority} C:${node.cost}]`;
      lines.push(`    ${label}${style}`);
    }
    
    // 添加边
    for (const edge of edges) {
      lines.push(`    ${edge.from} --> ${edge.to}`);
    }
    
    // 添加样式
    lines.push('');
    lines.push('    classDef pending fill:#f9f,stroke:#333,stroke-width:2px');
    lines.push('    classDef ready fill:#9f9,stroke:#333,stroke-width:2px');
    lines.push('    classDef running fill:#ff9,stroke:#333,stroke-width:4px');
    lines.push('    classDef completed fill:#9ff,stroke:#333,stroke-width:2px');
    lines.push('    classDef failed fill:#f99,stroke:#333,stroke-width:2px');
    lines.push('    classDef cancelled fill:#999,stroke:#333,stroke-width:2px');
    
    return lines.join('\n');
  }
  
  private static getNodeStyle(state: NodeState): string {
    switch (state) {
      case NodeState.PENDING: return ':::pending';
      case NodeState.READY: return ':::ready';
      case NodeState.RUNNING: return ':::running';
      case NodeState.COMPLETED: return ':::completed';
      case NodeState.FAILED: return ':::failed';
      case NodeState.CANCELLED: return ':::cancelled';
      default: return '';
    }
  }
  
  /**
   * 生成 DOT 格式(Graphviz)
   * 可以使用 Graphviz 工具渲染: https://graphviz.org/
   */
  static toDOT(nodes: INode[], edges: Array<{ from: string; to: string }>): string {
    const lines: string[] = ['digraph G {'];
    lines.push('    rankdir=TB;');
    lines.push('    node [shape=box, style=rounded];');
    lines.push('');
    
    // 添加节点
    for (const node of nodes) {
      const color = this.getNodeColor(node.state);
      const label = `${node.id}\\nP:${node.priority} C:${node.cost}`;
      lines.push(`    "${node.id}" [label="${label}", fillcolor="${color}", style="filled,rounded"];`);
    }
    
    lines.push('');
    
    // 添加边
    for (const edge of edges) {
      lines.push(`    "${edge.from}" -> "${edge.to}";`);
    }
    
    lines.push('}');
    return lines.join('\n');
  }
  
  private static getNodeColor(state: NodeState): string {
    switch (state) {
      case NodeState.PENDING: return '#ffccff';
      case NodeState.READY: return '#ccffcc';
      case NodeState.RUNNING: return '#ffffcc';
      case NodeState.COMPLETED: return '#ccffff';
      case NodeState.FAILED: return '#ffcccc';
      case NodeState.CANCELLED: return '#cccccc';
      default: return '#ffffff';
    }
  }
  
  /**
   * 生成简单的文本树形结构
   */
  static toTree(nodes: INode[], edges: Array<{ from: string; to: string }>): string {
    const lines: string[] = [];
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // 构建邻接表
    for (const node of nodes) {
      adjacency.set(node.id, []);
      inDegree.set(node.id, 0);
    }
    
    for (const edge of edges) {
      adjacency.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }
    
    // 找到根节点(入度为0)
    const roots = nodes.filter(node => inDegree.get(node.id) === 0);
    
    // 递归打印树
    const visited = new Set<string>();
    
    const printNode = (nodeId: string, prefix: string, isLast: boolean) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      const connector = isLast ? '└── ' : '├── ';
      const stateIcon = this.getStateIcon(node.state);
      const info = `${stateIcon} ${node.id} (P:${node.priority}, C:${node.cost})`;
      
      lines.push(prefix + connector + info);
      
      const children = adjacency.get(nodeId) || [];
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      
      children.forEach((childId, index) => {
        printNode(childId, newPrefix, index === children.length - 1);
      });
    };
    
    roots.forEach((root, index) => {
      printNode(root.id, '', index === roots.length - 1);
    });
    
    return lines.join('\n');
  }
  
  private static getStateIcon(state: NodeState): string {
    switch (state) {
      case NodeState.PENDING: return '⏸️';
      case NodeState.READY: return '✅';
      case NodeState.RUNNING: return '⚙️';
      case NodeState.COMPLETED: return '✔️';
      case NodeState.FAILED: return '❌';
      case NodeState.CANCELLED: return '🚫';
      default: return '❓';
    }
  }
  
  /**
   * 生成执行时间线
   */
  static generateTimeline(events: Array<{ time: number; nodeId: string; event: string }>): string {
    const lines: string[] = [];
    lines.push('执行时间线:');
    lines.push('═══════════════════════════════════════════');
    
    const startTime = events[0]?.time || 0;
    
    for (const event of events) {
      const elapsed = event.time - startTime;
      const timestamp = `[+${elapsed.toFixed(0)}ms]`.padEnd(12);
      lines.push(`${timestamp} ${event.nodeId.padEnd(15)} ${event.event}`);
    }
    
    lines.push('═══════════════════════════════════════════');
    return lines.join('\n');
  }
  
  /**
   * 生成依赖矩阵
   */
  static toDependencyMatrix(nodes: INode[], edges: Array<{ from: string; to: string }>): string {
    const nodeIds = nodes.map(n => n.id);
    const matrix: boolean[][] = Array(nodeIds.length).fill(null).map(() => 
      Array(nodeIds.length).fill(false)
    );
    
    // 填充矩阵
    for (const edge of edges) {
      const fromIdx = nodeIds.indexOf(edge.from);
      const toIdx = nodeIds.indexOf(edge.to);
      if (fromIdx !== -1 && toIdx !== -1) {
        matrix[fromIdx][toIdx] = true;
      }
    }
    
    // 生成表格
    const lines: string[] = [];
    lines.push('依赖矩阵 (行 → 列):');
    lines.push('');
    
    // 表头
    const header = '     ' + nodeIds.map(id => id.substring(0, 4).padEnd(5)).join('');
    lines.push(header);
    lines.push('     ' + '─'.repeat(nodeIds.length * 5));
    
    // 表格内容
    for (let i = 0; i < nodeIds.length; i++) {
      const row = nodeIds[i].substring(0, 4).padEnd(5) + 
        matrix[i].map(val => (val ? '  ✓  ' : '  ·  ')).join('');
      lines.push(row);
    }
    
    return lines.join('\n');
  }
  
  /**
   * 生成关键路径分析
   */
  static analyzeCriticalPath(nodes: INode[], edges: Array<{ from: string; to: string }>): string {
    const lines: string[] = [];
    lines.push('关键路径分析:');
    lines.push('═══════════════════════════════════════════');
    
    // 计算每个节点的最长路径
    const pathLengths = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    
    for (const node of nodes) {
      adjacency.set(node.id, []);
    }
    
    for (const edge of edges) {
      adjacency.get(edge.from)?.push(edge.to);
    }
    
    const dfs = (nodeId: string, visited: Set<string>): number => {
      if (visited.has(nodeId)) return pathLengths.get(nodeId) || 0;
      visited.add(nodeId);
      
      const children = adjacency.get(nodeId) || [];
      let maxPath = 0;
      
      for (const child of children) {
        maxPath = Math.max(maxPath, dfs(child, visited) + 1);
      }
      
      pathLengths.set(nodeId, maxPath);
      return maxPath;
    };
    
    const visited = new Set<string>();
    for (const node of nodes) {
      dfs(node.id, visited);
    }
    
    // 排序并显示
    const sorted = Array.from(pathLengths.entries())
      .sort((a, b) => b[1] - a[1]);
    
    for (const [nodeId, length] of sorted) {
      const node = nodes.find(n => n.id === nodeId);
      const bar = '█'.repeat(length + 1);
      lines.push(`${nodeId.padEnd(15)} ${bar} (${length} 步, 成本: ${node?.cost || 0})`);
    }
    
    lines.push('═══════════════════════════════════════════');
    return lines.join('\n');
  }
  
  /**
   * 生成性能报告
   */
  static generatePerformanceReport(
    nodes: INode[],
    executionTimes: Map<string, number>
  ): string {
    const lines: string[] = [];
    lines.push('性能报告:');
    lines.push('═══════════════════════════════════════════');
    
    const totalTime = Array.from(executionTimes.values())
      .reduce((sum, time) => sum + time, 0);
    
    lines.push(`总执行时间: ${totalTime.toFixed(2)}ms`);
    lines.push(`节点数量: ${nodes.length}`);
    lines.push(`平均执行时间: ${(totalTime / nodes.length).toFixed(2)}ms`);
    lines.push('');
    lines.push('节点执行时间:');
    
    const sorted = Array.from(executionTimes.entries())
      .sort((a, b) => b[1] - a[1]);
    
    for (const [nodeId, time] of sorted) {
      const percentage = ((time / totalTime) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(time / 10));
      lines.push(`  ${nodeId.padEnd(15)} ${time.toFixed(2)}ms (${percentage}%) ${bar}`);
    }
    
    lines.push('═══════════════════════════════════════════');
    return lines.join('\n');
  }
}

/**
 * 实时监控器
 */
export class GraphMonitor {
  private events: Array<{ time: number; nodeId: string; event: string }> = [];
  private executionTimes: Map<string, number> = new Map();
  private startTimes: Map<string, number> = new Map();
  
  onNodeStart(nodeId: string): void {
    const time = Date.now();
    this.startTimes.set(nodeId, time);
    this.events.push({ time, nodeId, event: '开始执行' });
  }
  
  onNodeComplete(nodeId: string): void {
    const time = Date.now();
    const startTime = this.startTimes.get(nodeId);
    if (startTime) {
      const duration = time - startTime;
      this.executionTimes.set(nodeId, duration);
    }
    this.events.push({ time, nodeId, event: '执行完成' });
  }
  
  onNodeFail(nodeId: string, error: Error): void {
    const time = Date.now();
    this.events.push({ time, nodeId, event: `执行失败: ${error.message}` });
  }
  
  getTimeline(): string {
    return GraphVisualizer.generateTimeline(this.events);
  }
  
  getPerformanceReport(nodes: INode[]): string {
    return GraphVisualizer.generatePerformanceReport(nodes, this.executionTimes);
  }
  
  clear(): void {
    this.events = [];
    this.executionTimes.clear();
    this.startTimes.clear();
  }
}

/**
 * 使用示例
 */
export function visualizerExample() {
  console.log('\n=== 可视化工具示例 ===\n');
  
  // 模拟一些节点和边
  const nodes: INode[] = [
    { id: 'A', priority: 0, cost: 1, state: NodeState.COMPLETED } as INode,
    { id: 'B', priority: 1, cost: 2, state: NodeState.RUNNING } as INode,
    { id: 'C', priority: 1, cost: 1, state: NodeState.READY } as INode,
    { id: 'D', priority: 2, cost: 3, state: NodeState.PENDING } as INode,
  ];
  
  const edges = [
    { from: 'A', to: 'B' },
    { from: 'A', to: 'C' },
    { from: 'B', to: 'D' },
    { from: 'C', to: 'D' },
  ];
  
  // 树形结构
  console.log('树形结构:');
  console.log(GraphVisualizer.toTree(nodes, edges));
  console.log('');
  
  // 依赖矩阵
  console.log(GraphVisualizer.toDependencyMatrix(nodes, edges));
  console.log('');
  
  // 关键路径
  console.log(GraphVisualizer.analyzeCriticalPath(nodes, edges));
  console.log('');
  
  // Mermaid 图
  console.log('Mermaid 流程图:');
  console.log(GraphVisualizer.toMermaid(nodes, edges));
  console.log('');
  
  // DOT 格式
  console.log('Graphviz DOT:');
  console.log(GraphVisualizer.toDOT(nodes, edges));
}

// 如果直接运行此文件
if (require.main === module) {
  visualizerExample();
}

