/**
 * 图可视化组件
 * 
 * 使用 SVG 绘制节点图，展示图的结构和执行过程
 */

import { INode, NodeState } from './Node';
import { Edge } from './Edge';
import { Graph } from './GraphImpl';

/**
 * 节点可视化配置
 */
interface NodeVisualConfig {
    id: string;
    label: string;
    x: number;
    y: number;
    state: NodeState;
    priority: number;
    cost: number;
}

/**
 * 边可视化配置
 */
interface EdgeVisualConfig {
    id: string;
    sourceId: string;
    targetId: string;
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    animated: boolean;
}

/**
 * 图可视化器类
 * 
 * 负责渲染节点图，包括节点、边和动画效果
 */
export class GraphVisualizer {
    private container: HTMLElement;
    private svg: SVGElement;
    private nodesGroup: SVGGElement;
    private edgesGroup: SVGGElement;
    private nodeElements: Map<string, SVGGElement> = new Map();
    private edgeElements: Map<string, SVGPathElement> = new Map();
    private nodeConfigs: Map<string, NodeVisualConfig> = new Map();
    private edgeConfigs: Map<string, EdgeVisualConfig> = new Map();
    private width: number = 800;
    private height: number = 600;
    private nodeRadius: number = 30;
    private animationId: number | null = null;

    /**
     * 创建图可视化器实例
     * 
     * @param {HTMLElement} container - 容器元素
     * @param {number} width - 画布宽度，默认 800
     * @param {number} height - 画布高度，默认 600
     */
    constructor(container: HTMLElement, width: number = 800, height: number = 600) {
        this.container = container;
        this.width = width;
        this.height = height;
        
        // 创建 SVG 元素
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', width.toString());
        this.svg.setAttribute('height', height.toString());
        this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.svg.style.border = '1px solid #e0e0e0';
        this.svg.style.borderRadius = '8px';
        this.svg.style.background = '#fafafa';
        
        // 创建分组
        this.edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.edgesGroup.setAttribute('class', 'edges');
        this.nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.nodesGroup.setAttribute('class', 'nodes');
        
        this.svg.appendChild(this.edgesGroup);
        this.svg.appendChild(this.nodesGroup);
        
        container.appendChild(this.svg);
    }

    /**
     * 从 Graph 对象构建可视化
     * 
     * @param {Graph} graph - 要可视化的图对象
     * @returns {void}
     */
    buildFromGraph(graph: Graph): void {
        // 获取所有节点和边（通过私有属性访问）
        const graphInternal = graph as any;
        const nodes = Array.from(graphInternal.nodes?.values() || []) as INode[];
        const edges = Array.from(graphInternal.edges?.values() || []) as Edge[];
        
        if (nodes.length === 0) {
            return;
        }
        
        // 计算布局
        const layout = this.calculateLayout(nodes, edges);
        
        // 创建节点配置
        nodes.forEach((node) => {
            const pos = layout.nodes.get(node.id);
            if (pos) {
                this.nodeConfigs.set(node.id, {
                    id: node.id,
                    label: node.id,
                    x: pos.x,
                    y: pos.y,
                    state: node.state,
                    priority: node.priority,
                    cost: node.cost,
                });
            }
        });
        
        // 创建边配置
        edges.forEach(edge => {
            const sourceConfig = this.nodeConfigs.get(edge.source.node.id);
            const targetConfig = this.nodeConfigs.get(edge.target.node.id);
            
            if (sourceConfig && targetConfig) {
                this.edgeConfigs.set(edge.id, {
                    id: edge.id,
                    sourceId: edge.source.node.id,
                    targetId: edge.target.node.id,
                    sourceX: sourceConfig.x,
                    sourceY: sourceConfig.y,
                    targetX: targetConfig.x,
                    targetY: targetConfig.y,
                    animated: false,
                });
            }
        });
        
        // 渲染
        this.render();
    }

    /**
     * 计算节点布局（层次布局）
     * 
     * @private
     * @param {INode[]} nodes - 节点数组
     * @param {Edge[]} edges - 边数组
     * @returns {Map<string, {x: number, y: number}>} 节点位置映射
     */
    private calculateLayout(
        nodes: INode[],
        edges: Edge[]
    ): { nodes: Map<string, { x: number; y: number }> } {
        const positions = new Map<string, { x: number; y: number }>();
        
        // 构建邻接表
        const adjacency = new Map<string, string[]>();
        const inDegree = new Map<string, number>();
        
        nodes.forEach(node => {
            adjacency.set(node.id, []);
            inDegree.set(node.id, 0);
        });
        
        edges.forEach(edge => {
            const sourceId = edge.source.node.id;
            const targetId = edge.target.node.id;
            adjacency.get(sourceId)?.push(targetId);
            inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
        });
        
        // 拓扑排序分层
        const layers: string[][] = [];
        const remaining = new Set(nodes.map(n => n.id));
        
        while (remaining.size > 0) {
            const currentLayer: string[] = [];
            
            for (const nodeId of remaining) {
                if (inDegree.get(nodeId) === 0) {
                    currentLayer.push(nodeId);
                }
            }
            
            if (currentLayer.length === 0) {
                // 处理循环依赖
                const first = Array.from(remaining)[0];
                currentLayer.push(first);
            }
            
            currentLayer.forEach(nodeId => {
                remaining.delete(nodeId);
                adjacency.get(nodeId)?.forEach(targetId => {
                    inDegree.set(targetId, (inDegree.get(targetId) || 0) - 1);
                });
            });
            
            layers.push(currentLayer);
        }
        
        // 计算位置
        const layerHeight = this.height / (layers.length + 1);
        const padding = 50;
        
        layers.forEach((layer, layerIndex) => {
            const layerWidth = this.width - 2 * padding;
            const nodeSpacing = layer.length > 1 
                ? layerWidth / (layer.length - 1) 
                : 0;
            const startX = padding + (layer.length === 1 ? layerWidth / 2 : 0);
            
            layer.forEach((nodeId, nodeIndex) => {
                const x = startX + nodeIndex * nodeSpacing;
                const y = padding + (layerIndex + 1) * layerHeight;
                positions.set(nodeId, { x, y });
            });
        });
        
        return { nodes: positions };
    }

    /**
     * 渲染所有元素
     * 
     * @private
     * @returns {void}
     */
    private render(): void {
        // 清空现有元素
        this.edgesGroup.innerHTML = '';
        this.nodesGroup.innerHTML = '';
        this.nodeElements.clear();
        this.edgeElements.clear();
        
        // 渲染边
        this.edgeConfigs.forEach(config => {
            this.renderEdge(config);
        });
        
        // 渲染节点
        this.nodeConfigs.forEach(config => {
            this.renderNode(config);
        });
    }

    /**
     * 渲染单个边
     * 
     * @private
     * @param {EdgeVisualConfig} config - 边配置
     * @returns {void}
     */
    private renderEdge(config: EdgeVisualConfig): void {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        
        // 计算控制点（贝塞尔曲线）
        const dx = config.targetX - config.sourceX;
        const dy = config.targetY - config.sourceY;
        const controlOffset = Math.min(Math.abs(dx) * 0.3, 50);
        
        const pathData = `M ${config.sourceX} ${config.sourceY} 
                          C ${config.sourceX + controlOffset} ${config.sourceY}, 
                            ${config.targetX - controlOffset} ${config.targetY}, 
                            ${config.targetX} ${config.targetY}`;
        
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', '#999');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        
        if (config.animated) {
            path.setAttribute('class', 'animated-edge');
            this.animateEdge(path);
        }
        
        this.edgeElements.set(config.id, path);
        this.edgesGroup.appendChild(path);
    }

    /**
     * 渲染单个节点
     * 
     * @private
     * @param {NodeVisualConfig} config - 节点配置
     * @returns {void}
     */
    private renderNode(config: NodeVisualConfig): void {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', `node node-${config.state}`);
        group.setAttribute('transform', `translate(${config.x}, ${config.y})`);
        
        // 节点圆圈
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', this.nodeRadius.toString());
        circle.setAttribute('fill', this.getNodeColor(config.state));
        circle.setAttribute('stroke', '#333');
        circle.setAttribute('stroke-width', '2');
        
        // 节点标签
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', '#fff');
        text.textContent = config.label;
        
        // 优先级标签（右上角）
        const priorityText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        priorityText.setAttribute('x', (this.nodeRadius - 5).toString());
        priorityText.setAttribute('y', (-this.nodeRadius + 5).toString());
        priorityText.setAttribute('font-size', '10');
        priorityText.setAttribute('fill', '#666');
        priorityText.textContent = `P:${config.priority}`;
        
        group.appendChild(circle);
        group.appendChild(text);
        group.appendChild(priorityText);
        
        // 添加悬停效果
        group.addEventListener('mouseenter', () => {
            circle.setAttribute('stroke-width', '3');
            circle.setAttribute('stroke', '#667eea');
        });
        
        group.addEventListener('mouseleave', () => {
            circle.setAttribute('stroke-width', '2');
            circle.setAttribute('stroke', '#333');
        });
        
        // 添加工具提示
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `节点: ${config.label}\n状态: ${config.state}\n优先级: ${config.priority}\n成本: ${config.cost}`;
        group.appendChild(title);
        
        this.nodeElements.set(config.id, group);
        this.nodesGroup.appendChild(group);
    }

    /**
     * 获取节点状态对应的颜色
     * 
     * @private
     * @param {NodeState} state - 节点状态
     * @returns {string} 颜色值
     */
    private getNodeColor(state: NodeState): string {
        switch (state) {
            case NodeState.PENDING:
                return '#cccccc';
            case NodeState.READY:
                return '#4caf50';
            case NodeState.RUNNING:
                return '#ffc107';
            case NodeState.COMPLETED:
                return '#2196f3';
            case NodeState.FAILED:
                return '#f44336';
            case NodeState.CANCELLED:
                return '#9e9e9e';
            default:
                return '#cccccc';
        }
    }

    /**
     * 更新节点状态
     * 
     * @param {string} nodeId - 节点 ID
     * @param {NodeState} state - 新状态
     * @returns {void}
     */
    updateNodeState(nodeId: string, state: NodeState): void {
        const config = this.nodeConfigs.get(nodeId);
        if (config) {
            config.state = state;
            
            const element = this.nodeElements.get(nodeId);
            if (element) {
                const circle = element.querySelector('circle');
                if (circle) {
                    circle.setAttribute('fill', this.getNodeColor(state));
                }
                
                // 更新类名
                element.setAttribute('class', `node node-${state}`);
            }
        }
    }

    /**
     * 启动边的动画
     * 
     * @param {string} edgeId - 边 ID
     * @returns {void}
     */
    animateEdge(edgeId: string): void {
        const config = this.edgeConfigs.get(edgeId);
        if (config) {
            config.animated = true;
            
            const element = this.edgeElements.get(edgeId);
            if (element) {
                element.setAttribute('class', 'animated-edge');
                this.animateEdge(element);
            }
        }
    }

    /**
     * 为边添加动画效果
     * 
     * @private
     * @param {SVGPathElement} path - 路径元素
     * @returns {void}
     */
    private animateEdge(path: SVGPathElement): void {
        const length = path.getTotalLength();
        
        // 创建动画路径
        const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animate.setAttribute('attributeName', 'stroke-dashoffset');
        animate.setAttribute('from', length.toString());
        animate.setAttribute('to', '0');
        animate.setAttribute('dur', '1s');
        animate.setAttribute('repeatCount', 'indefinite');
        
        path.setAttribute('stroke-dasharray', length.toString());
        path.setAttribute('stroke', '#667eea');
        path.setAttribute('stroke-width', '3');
        path.appendChild(animate);
    }

    /**
     * 停止边的动画
     * 
     * @param {string} edgeId - 边 ID
     * @returns {void}
     */
    stopEdgeAnimation(edgeId: string): void {
        const config = this.edgeConfigs.get(edgeId);
        if (config) {
            config.animated = false;
            
            const element = this.edgeElements.get(edgeId);
            if (element) {
                element.setAttribute('class', '');
                element.setAttribute('stroke', '#999');
                element.setAttribute('stroke-width', '2');
                const animate = element.querySelector('animate');
                if (animate) {
                    animate.remove();
                }
                element.removeAttribute('stroke-dasharray');
                element.removeAttribute('stroke-dashoffset');
            }
        }
    }

    /**
     * 添加箭头标记定义
     * 
     * @returns {void}
     */
    addArrowMarker(): void {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3, 0 6');
        polygon.setAttribute('fill', '#999');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        this.svg.insertBefore(defs, this.svg.firstChild);
    }

    /**
     * 清空可视化
     * 
     * @returns {void}
     */
    clear(): void {
        this.nodeConfigs.clear();
        this.edgeConfigs.clear();
        this.nodeElements.clear();
        this.edgeElements.clear();
        this.edgesGroup.innerHTML = '';
        this.nodesGroup.innerHTML = '';
        
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * 销毁可视化器
     * 
     * @returns {void}
     */
    destroy(): void {
        this.clear();
        if (this.svg.parentNode) {
            this.svg.parentNode.removeChild(this.svg);
        }
    }
}

