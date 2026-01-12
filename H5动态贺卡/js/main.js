/**
 * H5动态贺卡 - 主逻辑控制器
 * 职责：初始化、通信监听、全局状态管理、响应式适配
 */

// 全局状态管理器
const AppState = {
    // 当前配置
    config: {
        greeting_words: ['burger', 'horse', 'banana'], // 默认多选
        card_style: 'pixel_world', // 默认风格更新为像素世界
        auto_play: true,
        recipient: '妈妈',
        message_body: '亲爱的妈妈，愿你诸事顺遂，活力满满，开心每一天~',
        sender: 'XXX',
        float_speed: 15 // 飞行速度 (秒)，越小越快
    },
    
    // 初始化
    init() {
        this.setupPostMessageListener();
        this.setupResponsiveLayout();
        this.setupGlobalEvents();
        window.addEventListener('resize', this.setupResponsiveLayout);
        
        console.log('App Initialized');
        
        // 启动各模块
        if (window.FloaterSystem) window.FloaterSystem.init();
        if (window.CardSystem) window.CardSystem.init();
    },

    // 监听 PostMessage
    setupPostMessageListener() {
        window.addEventListener('message', (event) => {
            const msg = event.data;
            console.log('[H5] Received message:', msg);

            if (msg.cmd === 'update_card') {
                this.updateConfig(msg.content);
            }
        });
    },

    // 更新配置并触发重绘
    updateConfig(newConfig) {
        if (!newConfig) return;
        
        // 兼容处理：如果传过来的是字符串，转为数组 (防止旧代码报错)
        if (newConfig.greeting_words && typeof newConfig.greeting_words === 'string') {
            newConfig.greeting_words = [newConfig.greeting_words];
        }

        // 合并配置
        this.config = { ...this.config, ...newConfig };
        console.log('[H5] Config updated:', this.config);

        // 通知各子系统更新
        // 1. 更新漂浮系统 (重新生成挂件)
        if (window.FloaterSystem) {
            window.FloaterSystem.refresh(this.config.greeting_words);
        }

        // 2. 更新贺卡内容 (不打开，只是更新数据)
        if (window.CardSystem) {
            window.CardSystem.updateData(this.config);
        }
    },

    // 响应式布局：终极适配 (Absolute Center + Scale)
    // 逻辑：Wrapper 绝对定位在屏幕中心，然后根据屏幕尺寸计算缩放比例
    // 这样无论屏幕比例如何，Wrapper 永远在正中间，且不会因为 transform 导致的占位问题偏移
    setupResponsiveLayout() {
        const wrapper = document.getElementById('stage-wrapper');
        if (!wrapper) return;

        // 设计稿尺寸（基准）
        const designWidth = 1000;
        const designHeight = 750;

        // 获取视口尺寸
        const clientWidth = document.documentElement.clientWidth;
        const clientHeight = document.documentElement.clientHeight;

        // 计算缩放比例 (Contain 模式)
        // 预留更安全的边距：宽 98%，高 96% (视口越小越需要利用空间，但也需要防溢出)
        // 如果是 PC 端，可以留多点；移动端留少点
        const isMobile = clientWidth < 800;
        const safeMarginX = isMobile ? 0.98 : 0.95;
        const safeMarginY = isMobile ? 0.98 : 0.95;

        const scaleX = (clientWidth * safeMarginX) / designWidth;
        const scaleY = (clientHeight * safeMarginY) / designHeight;
        
        // 取较小值，保证完整放入
        const scale = Math.min(scaleX, scaleY);
        
        // 应用 Transform
        // 关键：保持 translate(-50%, -50%) 用于居中，叠加 scale
        wrapper.style.width = `${designWidth}px`;
        wrapper.style.height = `${designHeight}px`;
        wrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
        
        // 布局计算完成后显示舞台，消除加载时的闪烁/跳变
        wrapper.style.opacity = '1';
        
        console.log(`Layout updated (Absolute+Scale): scale=${scale.toFixed(4)}`);
    },

    // 绑定全局事件
    setupGlobalEvents() {
        // 全局关闭按钮已移除
    }
};

// 暴露给全局，方便其他模块调用
window.AppState = AppState;

// 启动
document.addEventListener('DOMContentLoaded', () => {
    AppState.init();
});
