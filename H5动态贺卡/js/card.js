/**
 * 贺卡系统
 * 职责：弹窗管理、序列帧播放、内容渲染
 */
const CardSystem = {
    modal: null,
    canvas: null,
    ctx: null,
    slider: null,
    container: null, // 贺图容器
    
    // 状态
    currentFrame: 1,
    totalFrames: 16,
    isPlaying: false,
    playInterval: null,
    isDragging: false,
    startX: 0,
    startFrame: 1,
    
    // 资源缓存
    frameImages: [],
    imagesLoaded: false,

    init() {
        this.modal = document.getElementById('card-modal');
        this.canvas = document.getElementById('frame-canvas');
        this.slider = document.getElementById('frame-slider');
        this.container = document.querySelector('.frame-player-container');
        
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }

        // 绑定事件
        this.bindEvents();
    },

    // 预加载序列帧
    preloadFrames(styleName) {
        this.frameImages = [];
        this.imagesLoaded = false;
        let loadedCount = 0;
        
        // 假设文件名为 1.png, 2.png ... 16.png
        // 路径：assets/frames/{styleName}/{i}.png
        // 如果没有 styleName，默认用 'pixel_night'
        const style = styleName || 'pixel_night';
        
        for (let i = 1; i <= this.totalFrames; i++) {
            const img = new Image();
            // 这里假设图片格式为 JPG
            img.src = `assets/frames/${style}/${i}.jpg`;
            img.onload = () => {
                loadedCount++;
                if (loadedCount === this.totalFrames) {
                    this.imagesLoaded = true;
                    console.log(`[Card] All ${this.totalFrames} frames loaded for style: ${style}`);
                    // 如果正在打开状态，立即重绘当前帧以显示图片
                    if (!this.modal.classList.contains('hidden')) {
                        this.renderFrame();
                    }
                }
            };
            img.onerror = () => {
                console.warn(`[Card] Failed to load frame ${i} for style: ${style}`);
            };
            this.frameImages[i] = img; // 索引对应帧数
        }
    },

    open(floaterConfig) {
        if (!this.modal) return;
        
        // 1. 设置标题
        document.getElementById('light-up-name').innerText = floaterConfig.text || '...';

        // 2. 显示弹窗
        this.modal.classList.remove('hidden');
        this.modal.style.display = 'flex';
        
        // 3. 预加载图片 (根据配置的 style)
        // 注意：每次打开都预加载可能有点慢，建议在 AppState 更新配置时预加载
        // 这里为了确保一致性，先简单处理，如果 style 没变可以复用
        const currentStyle = window.AppState.config.card_style;
        if (!this.currentLoadedStyle || this.currentLoadedStyle !== currentStyle) {
            this.preloadFrames(currentStyle);
            this.currentLoadedStyle = currentStyle;
        }

        // 4. 开始播放序列帧
        this.currentFrame = 1;
        this.renderFrame();
        this.updateSlider();
        
        if (window.AppState.config.auto_play) {
            this.play();
        }
    },

    bindEvents() {
        // 关闭/接受祝福
        const acceptBtn = document.getElementById('accept-btn');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', () => {
                this.close();
            });
        }

        // 进度条拖动
        if (this.slider) {
            this.slider.addEventListener('input', (e) => {
                // 拖动时暂停自动播放
                this.pause();
                this.currentFrame = parseInt(e.target.value);
                this.renderFrame();
            });
        }

        // --- 贺图区域手势交互 ---
        if (this.container) {
            // 鼠标按下 / 手指触摸
            const startDrag = (e) => {
                this.isDragging = true;
                this.pause(); // 暂停播放
                this.startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
                this.startFrame = this.currentFrame;
                // 防止默认拖拽图片行为
                e.preventDefault();
            };

            // 移动
            const onDrag = (e) => {
                if (!this.isDragging) return;
                
                const currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
                const deltaX = currentX - this.startX;
                
                // 灵敏度：每滑动 10px 切换 1 帧 (可调整)
                const sensitivity = 10;
                const frameDelta = Math.round(deltaX / sensitivity);
                
                let newFrame = this.startFrame + frameDelta;
                
                // 循环逻辑 (可选，或者限制在 1-16)
                // 这里选择限制在 1-16，不循环，符合直觉
                if (newFrame < 1) newFrame = 1;
                if (newFrame > this.totalFrames) newFrame = this.totalFrames;
                
                if (newFrame !== this.currentFrame) {
                    this.currentFrame = newFrame;
                    this.renderFrame();
                    this.updateSlider();
                }
            };

            // 结束
            const endDrag = () => {
                this.isDragging = false;
            };

            // 绑定 PC 事件
            this.container.addEventListener('mousedown', startDrag);
            document.addEventListener('mousemove', onDrag); // 绑在 document 上防止拖出容器失效
            document.addEventListener('mouseup', endDrag);

            // 绑定 Mobile 事件
            this.container.addEventListener('touchstart', startDrag, { passive: false });
            document.addEventListener('touchmove', onDrag, { passive: false });
            document.addEventListener('touchend', endDrag);
        }
    },

    // 更新文本数据
    updateData(config) {
        document.getElementById('card-recipient').innerText = config.recipient || '妈妈';
        document.getElementById('card-message').innerText = config.message_body || '...';
        document.getElementById('card-sender').innerText = config.sender || 'XXX';
    },

    // 回调钩子
    onClose: null,

    close() {
        if (!this.modal) return;
        this.modal.classList.add('hidden');
        this.pause();
        
        // 触发回调
        if (this.onClose) {
            this.onClose();
            this.onClose = null; // 只能触发一次，防止逻辑污染
        }
        
        // 动画结束后隐藏 display
        setTimeout(() => {
            this.modal.style.display = 'none';
        }, 300);
    },

    // 播放控制
    play() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        
        if (this.playInterval) clearInterval(this.playInterval);
        this.playInterval = setInterval(() => {
            this.currentFrame++;
            
            // 修改：播放一轮后停止
            if (this.currentFrame > this.totalFrames) {
                this.currentFrame = this.totalFrames; // 停在最后一帧
                this.pause(); // 停止播放
                this.updateSlider();
                this.renderFrame();
                return;
            }
            
            this.updateSlider();
            this.renderFrame();
        }, 100); // 10fps
    },

    pause() {
        this.isPlaying = false;
        if (this.playInterval) clearInterval(this.playInterval);
    },

    updateSlider() {
        if (this.slider) {
            this.slider.value = this.currentFrame;
        }
    },

    // 核心渲染逻辑
    renderFrame() {
        if (!this.ctx) return;
        
        // --- DPI 高清适配 ---
        // 获取设备像素比
        const dpr = window.devicePixelRatio || 1;
        // 获取 CSS 宽高 (显示尺寸)
        // 注意：canvas.width/height 是物理像素，canvas.style.width/height 是逻辑像素
        const rect = this.canvas.getBoundingClientRect();
        
        // 只有当 rect 有效时才重置 canvas 尺寸 (避免初始化时宽度为0导致清空)
        if (rect.width > 0 && rect.height > 0) {
             // 如果物理尺寸不匹配，重新设置
            if (this.canvas.width !== Math.round(rect.width * dpr) || 
                this.canvas.height !== Math.round(rect.height * dpr)) {
                
                this.canvas.width = Math.round(rect.width * dpr);
                this.canvas.height = Math.round(rect.height * dpr);
                
                // 缩放 Context，这样后续绘制坐标不需要乘 dpr
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        }
        
        const width = rect.width;   // 使用逻辑宽度
        const height = rect.height; // 使用逻辑高度

        // 清空 (使用逻辑坐标)
        this.ctx.clearRect(0, 0, width, height);
        
        // --- 绘制背景 (序列帧图片) ---
        const img = this.frameImages[this.currentFrame];
        if (img && img.complete && img.naturalWidth !== 0) {
            // 图片加载成功，绘制图片
            // 保持比例铺满 (Cover 模式)
            const imgRatio = img.naturalWidth / img.naturalHeight;
            const canvasRatio = width / height;
            
            let drawWidth, drawHeight, offsetX, offsetY;
            
            if (imgRatio > canvasRatio) {
                // 图片更宽，按高度适配
                drawHeight = height;
                drawWidth = height * imgRatio;
                offsetX = (width - drawWidth) / 2;
                offsetY = 0;
            } else {
                // 图片更高，按宽度适配
                drawWidth = width;
                drawHeight = width / imgRatio;
                offsetX = 0;
                offsetY = (height - drawHeight) / 2;
            }
            
            // 绘制图片
            this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            
        } else {
            // 图片未加载或加载失败，使用之前的颜色占位
            const hue = (this.currentFrame / this.totalFrames) * 360;
            this.ctx.fillStyle = `hsl(${hue}, 70%, 80%)`;
            this.ctx.fillRect(0, 0, width, height);
    
            // 绘制当前帧数 (Loading)
            this.ctx.fillStyle = '#333';
            this.ctx.font = '80px Arial'; 
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`Frame ${this.currentFrame}`, width/2, height/2);
    
            // 绘制风格标识
            this.ctx.font = '24px Arial';
            this.ctx.fillText(`Style: ${window.AppState.config.card_style}`, width/2, height/2 + 60);
            this.ctx.fillText(`(Loading...)`, width/2, height/2 + 90);
        }
    }
};

window.CardSystem = CardSystem;
