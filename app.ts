/**
 * 应用入口文件
 * 
 * 包含示例代码和 UI 交互逻辑
 */

import {
    Graph,
    Node,
    NodeContext,
    NodeConfig,
    DataFlowMode,
    DefaultSchedulingStrategy,
} from './graph';
import { GraphVisualizer } from './GraphVisualizer';
import { NodeState } from './Node';

// 示例节点类定义
class SourceNode extends Node {
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

class ComputeNode extends Node {
    private computeFn: (inputs: any) => Promise<any>;
    
    constructor(config: NodeConfig, computeFn: (inputs: any) => Promise<any>) {
        super(config);
        this.computeFn = computeFn;
    }
    
    protected async run(context: NodeContext): Promise<void> {
        const inputs: Record<string, any> = {};
        for (const inputEp of this.getInputEndpoints()) {
            inputs[inputEp.id] = context.getInput(inputEp.id);
        }
        const result = await this.computeFn(inputs);
        const outputEps = this.getOutputEndpoints();
        if (outputEps.length > 0) {
            await context.setOutput(outputEps[0].id, result);
        }
    }
}

class SinkNode extends Node {
    public results: any[] = [];
    
    constructor(config: NodeConfig) {
        super(config);
    }
    
    protected async run(context: NodeContext): Promise<void> {
        const inputs = this.getInputEndpoints();
        for (const inputEp of inputs) {
            const data = context.getInput(inputEp.id);
            if (data !== undefined) {
                this.results.push(data);
            }
        }
    }
    
    getResults(): any[] {
        return [...this.results];
    }
}

// 可视化器实例
const visualizers: Map<number, GraphVisualizer> = new Map();

/**
 * 创建并初始化可视化器
 */
function initVisualizer(index: number): GraphVisualizer | null {
    const container = document.getElementById(`visual-${index}`);
    if (!container) return null;
    
    // 清除旧的可视化器
    const oldVisualizer = visualizers.get(index);
    if (oldVisualizer) {
        oldVisualizer.destroy();
    }
    
    // 创建新的可视化器
    const visualizer = new GraphVisualizer(container, 800, 500);
    visualizer.addArrowMarker();
    visualizers.set(index, visualizer);
    
    return visualizer;
}

/**
 * 执行图并更新可视化
 */
async function executeWithVisualization(
    graph: Graph,
    visualizer: GraphVisualizer | null,
    updateOutput: (text: string) => void
): Promise<void> {
    // 构建可视化
    if (visualizer) {
        visualizer.buildFromGraph(graph);
        await new Promise(resolve => setTimeout(resolve, 100)); // 等待渲染
    }
    
    // 监听节点状态变化
    const nodes = Array.from((graph as any).nodes?.values() || []) as INode[];
    nodes.forEach(node => {
        let currentState = node.state;
        Object.defineProperty(node, 'state', {
            get() {
                return currentState;
            },
            set(newState: NodeState) {
                currentState = newState;
                if (visualizer) {
                    visualizer.updateNodeState(node.id, newState);
                }
            },
            enumerable: true,
            configurable: true,
        });
    });
    
    try {
        await graph.execute();
    } finally {
        stateObserver.disconnect();
    }
}

// 示例函数
const examples = {
    async example0() {
        const output = document.getElementById('output-0') as HTMLDivElement;
        if (!output) return;
        
        output.textContent = '正在执行...\n';
        
        const visualizer = initVisualizer(0);
        
        try {
            const graph = new Graph({ maxConcurrency: 1 });
            
            const source = new SourceNode({ id: 'source', priority: 0 }, { value: 10 });
            source.addOutputEndpoint('out');
            
            const transform = new ComputeNode(
                { id: 'transform', priority: 1 },
                async (inputs) => inputs.in.value * 2
            );
            transform.addInputEndpoint('in');
            transform.addOutputEndpoint('out');
            
            const sink = new SinkNode({ id: 'sink', priority: 2 });
            sink.addInputEndpoint('in');
            
            graph.addNode(source);
            graph.addNode(transform);
            graph.addNode(sink);
            
            graph.connect('source', 'out', 'transform', 'in');
            graph.connect('transform', 'out', 'sink', 'in');
            
            await executeWithVisualization(graph, visualizer, (text) => {
                output.textContent = text;
            });
            
            const results = sink.getResults();
            const stats = graph.getStats();
            
            output.textContent = `执行完成！\n\n结果: ${JSON.stringify(results, null, 2)}\n\n统计信息:\n${JSON.stringify(stats, null, 2)}`;
            output.classList.remove('empty');
        } catch (error: any) {
            output.textContent = `错误: ${error.message}\n${error.stack}`;
            output.classList.remove('empty');
        }
    },

    async example1() {
        const output = document.getElementById('output-1') as HTMLDivElement;
        if (!output) return;
        
        output.textContent = '正在执行...\n';
        
        const visualizer = initVisualizer(1);
        
        try {
            const graph = new Graph({ maxConcurrency: 3 });
            
            const source = new SourceNode({ id: 'source' }, [1, 2, 3, 4, 5]);
            source.addOutputEndpoint('out');
            
            const workers: ComputeNode[] = [];
            for (let i = 0; i < 3; i++) {
                const worker = new ComputeNode(
                    { id: `worker${i}`, priority: 1 },
                    async (inputs) => {
                        await new Promise(resolve => setTimeout(resolve, 100));
                        return inputs.in.map((x: number) => x * (i + 1));
                    }
                );
                worker.addInputEndpoint('in');
                worker.addOutputEndpoint('out');
                workers.push(worker);
            }
            
            const sink = new SinkNode({ id: 'sink' });
            sink.addInputEndpoint('in');
            
            graph.addNode(source);
            workers.forEach(w => {
                graph.addNode(w);
                graph.connect('source', 'out', w.id, 'in');
                graph.connect(w.id, 'out', 'sink', 'in');
            });
            graph.addNode(sink);
            
            const startTime = Date.now();
            await executeWithVisualization(graph, visualizer, (text) => {
                output.textContent = text;
            });
            const duration = Date.now() - startTime;
            
            const results = sink.getResults();
            const stats = graph.getStats();
            
            output.textContent = `执行完成！\n\n执行时间: ${duration}ms\n\n结果: ${JSON.stringify(results, null, 2)}\n\n统计信息:\n${JSON.stringify(stats, null, 2)}`;
            output.classList.remove('empty');
        } catch (error: any) {
            output.textContent = `错误: ${error.message}\n${error.stack}`;
            output.classList.remove('empty');
        }
    },

    async example2() {
        const output = document.getElementById('output-2') as HTMLDivElement;
        if (!output) return;
        
        output.textContent = '正在执行...\n';
        
        const visualizer = initVisualizer(2);
        
        try {
            const graph = new Graph({ maxConcurrency: 2 });
            
            const nodeA = new SourceNode({ id: 'A' }, 'data-A');
            nodeA.addOutputEndpoint('out');
            
            const nodeB = new ComputeNode({ id: 'B' }, async (inputs) => inputs.in + '-B');
            nodeB.addInputEndpoint('in');
            nodeB.addOutputEndpoint('out');
            
            const nodeC = new ComputeNode({ id: 'C' }, async (inputs) => inputs.in + '-C');
            nodeC.addInputEndpoint('in');
            nodeC.addOutputEndpoint('out1');
            nodeC.addOutputEndpoint('out2');
            
            const nodeD = new ComputeNode({ id: 'D' }, async (inputs) => inputs.in1 + inputs.in2 + '-D');
            nodeD.addInputEndpoint('in1');
            nodeD.addInputEndpoint('in2');
            nodeD.addOutputEndpoint('out');
            
            const nodeE = new ComputeNode({ id: 'E' }, async (inputs) => inputs.in + '-E');
            nodeE.addInputEndpoint('in');
            nodeE.addOutputEndpoint('out');
            
            const nodeF = new SinkNode({ id: 'F' });
            nodeF.addInputEndpoint('in1');
            nodeF.addInputEndpoint('in2');
            
            graph.addNode(nodeA);
            graph.addNode(nodeB);
            graph.addNode(nodeC);
            graph.addNode(nodeD);
            graph.addNode(nodeE);
            graph.addNode(nodeF);
            
            graph.connect('A', 'out', 'B', 'in');
            graph.connect('A', 'out', 'C', 'in');
            graph.connect('B', 'out', 'D', 'in1');
            graph.connect('C', 'out1', 'D', 'in2');
            graph.connect('C', 'out2', 'E', 'in');
            graph.connect('D', 'out', 'F', 'in1');
            graph.connect('E', 'out', 'F', 'in2');
            
            await executeWithVisualization(graph, visualizer, (text) => {
                output.textContent = text;
            });
            
            const results = nodeF.getResults();
            const stats = graph.getStats();
            
            output.textContent = `执行完成！\n\n结果: ${JSON.stringify(results, null, 2)}\n\n统计信息:\n${JSON.stringify(stats, null, 2)}`;
            output.classList.remove('empty');
        } catch (error: any) {
            output.textContent = `错误: ${error.message}\n${error.stack}`;
            output.classList.remove('empty');
        }
    },

    async example3() {
        const output = document.getElementById('output-3') as HTMLDivElement;
        if (!output) return;
        
        output.textContent = '正在执行...\n';
        
        const visualizer = initVisualizer(3);
        
        try {
            const graph = new Graph({ 
                maxConcurrency: 1,
                schedulingStrategy: new DefaultSchedulingStrategy()
            });
            
            const tasks = [
                { id: 'Low', priority: 10, data: 'low-priority' },
                { id: 'High', priority: 1, data: 'high-priority' },
                { id: 'Medium', priority: 5, data: 'medium-priority' },
                { id: 'Urgent', priority: 0, data: 'urgent-priority' },
            ];
            
            const sink = new SinkNode({ id: 'Sink' });
            sink.addInputEndpoint('in');
            graph.addNode(sink);
            
            for (const task of tasks) {
                const node = new SourceNode({ id: task.id, priority: task.priority }, task.data);
                node.addOutputEndpoint('out');
                graph.addNode(node);
                graph.connect(task.id, 'out', 'Sink', 'in');
            }
            
            await executeWithVisualization(graph, visualizer, (text) => {
                output.textContent = text;
            });
            
            const results = sink.getResults();
            const stats = graph.getStats();
            
            output.textContent = `执行完成！\n\n执行顺序（按优先级）:\n${results.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n预期顺序: Urgent → High → Medium → Low\n\n统计信息:\n${JSON.stringify(stats, null, 2)}`;
            output.classList.remove('empty');
        } catch (error: any) {
            output.textContent = `错误: ${error.message}\n${error.stack}`;
            output.classList.remove('empty');
        }
    }
};

// UI 函数
function showExample(index: number): void {
    // 隐藏所有面板
    document.querySelectorAll('.example-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // 显示选中的面板
    const panel = document.getElementById(`example-${index}`);
    if (panel) {
        panel.classList.add('active');
        
        // 初始化可视化器（如果还没有）
        if (!visualizers.has(index)) {
            initVisualizer(index);
        }
    }
    
    // 更新标签页
    document.querySelectorAll('.tab').forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });
}

function runExample(index: number): void {
    const exampleKey = `example${index}` as keyof typeof examples;
    if (examples[exampleKey]) {
        examples[exampleKey]();
    }
}

function clearOutput(index: number): void {
    const output = document.getElementById(`output-${index}`) as HTMLDivElement;
    if (output) {
        output.textContent = '点击"运行示例"按钮查看结果...';
        output.classList.add('empty');
    }
}

// 导出到全局作用域
declare global {
    interface Window {
        examples: typeof examples;
        showExample: typeof showExample;
        runExample: typeof runExample;
        clearOutput: typeof clearOutput;
    }
}

window.examples = examples;
window.showExample = showExample;
window.runExample = runExample;
window.clearOutput = clearOutput;

// 页面加载时初始化第一个示例的可视化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initVisualizer(0);
    });
} else {
    initVisualizer(0);
}

