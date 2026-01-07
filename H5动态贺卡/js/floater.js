/**
 * 漂浮挂件系统
 * 职责：生成、动画控制、点击交互
 */
const FloaterSystem = {
    container: null,
    floaters: [],
    isActive: true,
    
    // 目标总数：6个
    TARGET_COUNT: 6,
    
    // 分槽生成逻辑
    slots: [15, 27, 39, 51, 63, 75], 
    lastSlotIndex: -1,
    
    // 配置映射表
    types: {
        'burger': { text: '一堡口福', image: 'assets/item_burger.png' },
        'chips': { text: '薯你最棒', image: 'assets/item_chips.png' },
        'horse': { text: '马到成功', image: 'assets/item_horse.png' },
        'snowflake': { text: '冰雪聪明', image: 'assets/item_snowflake.png' },
        'banana': { text: '萌趣纳福', image: 'assets/item_banana.png' },
        'kitty': { text: '大吉大利', image: 'assets/item_kitty.png' }
    },

    init() {
        this.container = document.getElementById('floater-layer');
        if (!this.container) return;
        
        // 预加载图片 (简单处理，浏览器会自动缓存)
        Object.values(this.types).forEach(t => {
            const img = new Image();
            img.src = t.image;
        });

        this.refresh(window.AppState.config.greeting_words);
    },

    refresh(types) {
        this.clearAll();
        
        let typeList = [];
        if (Array.isArray(types)) {
            typeList = [...types];
        } else {
            typeList = [types];
        }
        
        const initialQueue = [];
        for (let i = 0; i < this.TARGET_COUNT; i++) {
            const typeKey = typeList[i % typeList.length];
            initialQueue.push(typeKey);
        }
        
        initialQueue.forEach((typeKey, index) => {
            this.createFloater(typeKey, true, index);
        });
        
        this.isActive = true;
    },

    clearAll() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.floaters.forEach(el => {
            if (el._anim) el._anim.cancel();
            if (el._refillTimer) clearTimeout(el._refillTimer); // 清除补充定时器
        });
        this.floaters = [];
        this.lastSlotIndex = -1;
    },

    // 补充新挂件
    refillOne() {
        if (!this.isActive) return;
        
        // 随机取一个类型
        const configTypes = window.AppState.config.greeting_words;
        let typeKey;
        if (Array.isArray(configTypes)) {
            typeKey = configTypes[Math.floor(Math.random() * configTypes.length)];
        } else {
            typeKey = configTypes;
        }
        
        this.createFloater(typeKey, false);
    },

    createFloater(typeKey, isInitial = false, initialIndex = 0) {
        if (!this.container) return;

        const config = this.types[typeKey] || this.types['burger'];
        const el = document.createElement('div');
        el.className = 'floater';
        
        // --- 槽位选择 ---
        let slotIndex;
        let attempts = 0;
        do {
            slotIndex = Math.floor(Math.random() * this.slots.length);
            attempts++;
        } while (slotIndex === this.lastSlotIndex && attempts < 3);
        this.lastSlotIndex = slotIndex;
        
        const baseLeft = this.slots[slotIndex];
        const randomOffset = (Math.random() - 0.5) * 10;
        const finalLeft = baseLeft + randomOffset;
        el.style.left = finalLeft + '%';
        
        // --- 尺寸 ---
        const scale = 1.3 + Math.random() * 0.3;
        el.style.transform = `scale(${scale})`;

        // --- 初始位置 ---
        let startBottom = -30;
        if (isInitial) {
            const layerHeight = 90 / this.TARGET_COUNT; 
            const baseBottom = initialIndex * layerHeight; 
            const offset = Math.random() * (layerHeight * 0.8);
            startBottom = baseBottom + offset;
            el.style.bottom = startBottom + '%';
        } else {
            el.style.bottom = '-30%';
        }

        // --- DOM ---
        const body = document.createElement('div');
        body.className = 'floater-body';
        body.style.backgroundImage = `url('${config.image}')`;
        body.title = config.text; 

        const string = document.createElement('div');
        string.className = 'floater-string';

        const tag = document.createElement('div');
        tag.className = 'floater-tag';
        tag.innerText = config.text;

        el.appendChild(body);
        el.appendChild(string);
        el.appendChild(tag);

        el.addEventListener('click', (e) => {
            this.handleFloaterClick(el, config);
            e.stopPropagation();
        });

        // --- 速度计算 ---
        // 基础速度由配置决定，加上微量随机
        const baseSpeed = window.AppState.config.float_speed || 15;
        const duration = baseSpeed * (0.9 + Math.random() * 0.2); // ±10% 波动
        
        let actualDuration = duration;
        // 如果是初始生成的，按比例缩短时间
        if (isInitial) {
            const totalDistance = 120 - (-30); 
            const remainingDistance = 120 - startBottom;
            actualDuration = duration * (remainingDistance / totalDistance);
        }

        this.animateFloater(el, actualDuration, startBottom, isInitial ? duration : actualDuration);

        this.container.appendChild(el);
        this.floaters.push(el);
    },

    animateFloater(el, duration, startBottom, fullDuration) {
        // 目标终点 120%
        const endBottom = 120;
        
        const animation = el.animate(
            [
                { bottom: startBottom + '%', opacity: 1 },
                { bottom: endBottom + '%', opacity: 1 }
            ],
            {
                duration: duration * 1000,
                easing: 'linear',
                iterations: 1 
            }
        );
        
        el.dataset.animationId = 'floating';
        el._anim = animation;

        // --- 核心优化：提前补充机制 ---
        // 计算挂件何时会飘到屏幕顶端 (约 100%)
        // 假设总路程是 -30% -> 120% (共150%)
        // 屏幕顶端是 100%，也就是飘了 130% 的距离
        // 时间点 = 总时间 * (130 / 150)
        
        // 简化算法：我们在动画播放到 85% 的时候就认为它“即将离开”，触发补充
        // 如果是初始挂件，因为它路程短，可能很快就出去了，所以统一用 setTimeout
        
        // 计算触发补充的时间点
        // 我们希望在它达到 bottom: 100% 的时候触发
        const totalDistance = endBottom - startBottom;
        const distanceToTop = 100 - startBottom;
        
        if (distanceToTop > 0) {
            const timeToTop = duration * (distanceToTop / totalDistance);
            
            // 设置定时器触发补充
            el._refillTimer = setTimeout(() => {
                this.refillOne();
            }, timeToTop * 1000);
        } else {
            // 已经在顶上了(极少见)，直接补
            this.refillOne();
        }

        // 动画完全结束时销毁 DOM
        animation.onfinish = () => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
            // 从数组移除 (虽然目前没用到数组做逻辑判断，但保持清洁)
            const idx = this.floaters.indexOf(el);
            if (idx > -1) this.floaters.splice(idx, 1);
        };
    },

    handleFloaterClick(el, config) {
        console.log('Clicked:', config.text);
        
        this.isActive = false;
        
        // --- 核心逻辑优化：暂停并记录状态 ---
        
        // 1. 暂停动画 (CSS Animation)
        // 这样它的 bottom 就卡在当前位置不动了
        el.style.animationPlayState = 'paused';
        
        // 2. 清除补充计时器 (因为这个挂件并没有消失，只是暂停了)
        if (el._refillTimer) clearTimeout(el._refillTimer);

        // 3. 记录当前几何信息
        const startRect = el.getBoundingClientRect();
        
        // 4. 获取当前 Transform 的 Scale (假设初始 scale 已经在 style transform 里了)
        // 解析 el.style.transform，例如 "scale(1.4)"
        // 如果没有，默认为 1
        let startScale = 1;
        const transformMatch = el.style.transform.match(/scale\(([^)]+)\)/);
        if (transformMatch && transformMatch[1]) {
            startScale = parseFloat(transformMatch[1]);
        }
        
        // 5. 计算位移目标 (舞台中心)
        const stageWrapper = document.getElementById('stage-wrapper');
        const stageRect = stageWrapper.getBoundingClientRect();
        
        const targetX = stageRect.width / 2;
        const targetY = stageRect.height / 2;

        const elCenterX = startRect.left + startRect.width / 2;
        const elCenterY = startRect.top + startRect.height / 2;
        
        const stageCenterX = stageRect.left + stageRect.width / 2;
        const stageCenterY = stageRect.top + stageRect.height / 2;

        const moveX = stageCenterX - elCenterX;
        const moveY = stageCenterY - elCenterY;

        // 6. 执行“飞入中心并放大”动画
        el.style.transition = 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)'; // 更有质感的缓动
        el.style.zIndex = 100;
        // 注意：这里是相对于元素【当前位置】的偏移
        // 此时它的 bottom 已经被 paused 锁住了
        // 这里的 transform 会覆盖掉之前的 scale(...)，所以我们要在目标状态里写上新的 scale(2)
        el.style.transform = `translate(${moveX}px, ${moveY}px) scale(2)`;
        
        setTimeout(() => {
            if (window.CardSystem) {
                // 确保 open 方法存在
                if (typeof window.CardSystem.open === 'function') {
                    window.CardSystem.open(config);
                } else {
                    console.error('[Floater] CardSystem.open is not a function');
                    return;
                }
            } else {
                console.error('[Floater] CardSystem is undefined');
                return;
            }
            
            // 覆写 CardSystem.onClose 以实现还原逻辑
            // 安全检查：确保 CardSystem 存在
            if (!window.CardSystem) return;

            const originalClose = window.CardSystem.onClose;
            window.CardSystem.onClose = () => {
                if (typeof originalClose === 'function') originalClose();
                
                // --- 核心逻辑优化：还原 ---
                
                // 1. 恢复 Transform 到原始状态 (无位移，原始 Scale)
                el.style.transition = 'transform 0.6s ease-out'; // 回去的动画稍快
                el.style.transform = `translate(0, 0) scale(${startScale})`;
                el.style.zIndex = ''; // 恢复层级 (可能需要等动画结束，这里立刻恢复也行，或者设一个稍高的)
                
                // 2. 等待 Transform 动画结束 (0.6s) 后，恢复漂浮
                setTimeout(() => {
                    // 恢复 CSS 动画播放
                    el.style.animationPlayState = 'running';
                    
                    this.isActive = true;
                    
                    // 3. 恢复“消失检测”与“补充机制”
                    // 因为之前 clearTimeout 了，现在需要重新计算剩余时间并 setRefillTimer
                    // 这一步比较麻烦，简单起见，我们直接让它自然飘走。
                    // 只有当它飘完并触发 onfinish 时，才会销毁。
                    // 但是，如果没有 refillTimer，屏幕上可能会少一个挂件直到这个挂件彻底消失。
                    // 考虑到它暂停了一段时间，这段时间本该飘走并生成新的。
                    // 策略：立即触发一次 refillOne 吗？不，那样会多。
                    // 策略：重新计算 refillTimer？
                    // 由于难以精确获取 animation 当前进度百分比，我们这里做一个简单的兜底：
                    // 如果它已经很高了（比如 bottom > 50%），我们直接补一个，防止上方空虚。
                    
                    // 获取当前 bottom 值 (通过 computed style，因为 animation 改变的是 computed value)
                    const computedStyle = window.getComputedStyle(el);
                    const bottomPx = parseFloat(computedStyle.bottom);
                    const stageHeight = stageRect.height;
                    const bottomPercent = (bottomPx / stageHeight) * 100;
                    
                    // 如果已经在屏幕上半部分了，立即补一个新挂件在底部，保持节奏
                    if (bottomPercent > 50) {
                        this.refillOne();
                    } else {
                        // 如果还在下面，我们重新估算一个 refillTimer
                        // 估算剩余时间：(100% - current%) / speed
                        // 这里略微复杂，简化为：不处理，等它飘走，或者依靠其他挂件的 refill。
                        // 其实最稳妥的是：什么都不做，因为我们的系统是基于“每个挂件自己触发补充”的。
                        // 它暂停了，补充也暂停了，恢复后，它继续飘，到顶了自然会触发补充。
                        // 唯一的问题是：暂停期间，本该有个新挂件出来的。
                        // 所以：立即补一个 Refill 是合理的，但这会导致屏幕上瞬间变成 7 个 (6 + 1)。
                        // 不过没关系，这个旧的马上就走了。
                        // 让我们选择：不做额外处理，让它继续负责它自己的 Refill 任务。
                        // 只需要重新挂载 refillTimer 吗？
                        // 不，原来的逻辑是 setTimeout(..., timeToTop)。
                        // 现在时间过去了，timeToTop 已经不准了。
                        // 实际上，我们无法恢复那个精确的 setTimeout。
                        // 替代方案：在 animateFloater 里，用 requestAnimationFrame 检测 bottom 值来触发 refill？
                        // 那样改动太大。
                        
                        // 这种情况下，最简单的 Hack：
                        // 直接补一个！哪怕暂时多一个也比空着强。
                        // 只有当它确实“比较高”了才补，避免底部堆积。
                        if (bottomPercent > 30) {
                             this.refillOne();
                             // 防止它将来再触发一次 refill (虽然它已经没有 refillTimer 了，但 animateFloater 逻辑里没有 flag 防止多次)
                             // 我们的 refillOne 是独立的。
                             // 但是我们需要防止这个老挂件再次触发。
                             // 给它打个标记
                             el._hasRefilled = true;
                        }
                        
                        // 还要恢复它的 _refillTimer 逻辑吗？
                        // 如果我们上面手动 refillOne 了，就不需要它再触发了。
                        // 如果没触发（还在底部），我们希望它将来能触发。
                        // 这需要重新计算时间，太复杂。
                        // 结论：直接补一个最省事。
                        if (!el._hasRefilled) {
                            this.refillOne();
                            el._hasRefilled = true; 
                        }
                    }

                }, 600); // 等待 transition 结束
                
            };
            
        }, 1000); // 等待飞入动画结束
    }
};

window.FloaterSystem = FloaterSystem;
