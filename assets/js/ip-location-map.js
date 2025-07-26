// IP地理位置和Leaflet地图管理脚本
class IPLocationMap {
    constructor(config) {
        this.ipinfoToken = config.token;
        this.visitorData = this.loadVisitorData();
        this.map = null;
        this.markers = [];
        this.init();
    }

    // 初始化
    async init() {
        await this.getCurrentVisitorInfo();
        
        // 确保DOM加载完成后再初始化地图
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initMap();
                this.updateDisplay();
            });
        } else {
            setTimeout(() => {
                this.initMap();
                this.updateDisplay();
            }, 100);
        }
    }

    // 获取当前访客信息
    async getCurrentVisitorInfo() {
        try {
            const response = await fetch(`https://ipinfo.io/json?token=${this.ipinfoToken}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.ip) {
                throw new Error('No IP address in response');
            }
            
            const visitorInfo = {
                ip: data.ip,
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country || 'Unknown',
                location: data.loc || '0,0',
                timezone: data.timezone || 'Unknown',
                org: data.org || 'Unknown',
                timestamp: new Date().toISOString(),
                visitCount: 1
            };

            // 检查是否是新访客
            const existingVisitor = this.visitorData.find(v => v.ip === visitorInfo.ip);
            if (existingVisitor) {
                existingVisitor.visitCount++;
                existingVisitor.lastVisit = visitorInfo.timestamp;
            } else {
                this.visitorData.push(visitorInfo);
            }

            this.saveVisitorData();
            this.currentVisitor = visitorInfo;
        } catch (error) {
            console.error('Error fetching IP location:', error);
            this.currentVisitor = {
                ip: 'Unknown',
                city: 'Unknown',
                country: 'Unknown',
                location: '0,0',
                timezone: 'Unknown',
                org: 'Unknown',
                visitCount: 1
            };
        }
    }

    // 加载访客数据
    loadVisitorData() {
        const saved = localStorage.getItem('visitor_locations');
        return saved ? JSON.parse(saved) : [];
    }

    // 保存访客数据
    saveVisitorData() {
        localStorage.setItem('visitor_locations', JSON.stringify(this.visitorData));
    }

    // 初始化Leaflet地图
    initMap() {
        if (this.map) {
            this.map.remove();
        }

        const mapContainer = document.getElementById('visitor-map');
        if (!mapContainer) {
            console.error('Map container not found!');
            return;
        }

        // 设置地图容器样式
        mapContainer.style.height = '300px';
        mapContainer.style.width = '100%';
        mapContainer.style.borderRadius = '8px';
        mapContainer.style.overflow = 'hidden';

        try {
            this.map = L.map('visitor-map').setView([0, 0], 2);
            
            // 使用彩色地图瓦片
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(this.map);

            this.addVisitorMarkers();
        } catch (error) {
            console.error('Error initializing map:', error);
        }
    }

    // 添加访客标记
    addVisitorMarkers() {
        this.markers.forEach(marker => marker.remove());
        this.markers = [];

        this.visitorData.forEach((visitor, index) => {
            if (visitor.location && visitor.location !== '0,0' && visitor.location !== 'Unknown') {
                try {
                    const [lat, lng] = visitor.location.split(',').map(Number);
                    
                    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
                        return;
                    }
                    
                    // 创建自定义图标
                    const customIcon = L.divIcon({
                        className: 'custom-marker',
                        html: `<div style="
                            background: linear-gradient(135deg, #333333 0%, #555555 100%);
                            border: 2px solid #ffffff;
                            border-radius: 50%;
                            width: 20px;
                            height: 20px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 10px;
                            font-weight: bold;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
                        ">${index + 1}</div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    });

                    const marker = L.marker([lat, lng], { icon: customIcon })
                        .addTo(this.map)
                        .bindPopup(`
                            <div class="visitor-popup">
                                <h4>访客 #${index + 1}</h4>
                                <p><strong>IP:</strong> ${visitor.ip}</p>
                                <p><strong>位置:</strong> ${visitor.city}, ${visitor.country}</p>
                                <p><strong>访问次数:</strong> ${visitor.visitCount}</p>
                                <p><strong>最后访问:</strong> ${new Date(visitor.timestamp).toLocaleString()}</p>
                            </div>
                        `);

                    this.markers.push(marker);
                } catch (error) {
                    console.error(`Error adding marker for visitor ${index + 1}:`, error);
                }
            }
        });

        if (this.markers.length > 0) {
            try {
                const group = new L.featureGroup(this.markers);
                this.map.fitBounds(group.getBounds().pad(0.1));
            } catch (error) {
                console.error('Error adjusting map bounds:', error);
            }
        }
    }

    // 更新显示
    updateDisplay() {
        this.updateVisitorStats();
    }

    // 更新访客统计
    updateVisitorStats() {
        const statsElement = document.getElementById('visitor-stats');
        if (statsElement && this.currentVisitor) {
            const totalVisitors = this.visitorData.length;
            const totalVisits = this.visitorData.reduce((sum, v) => sum + v.visitCount, 0);

            statsElement.innerHTML = `
                <div class="visitor-stats">
                    <div class="stat-item">
                        <i class="icon-users"></i>
                        <span>总访客: ${totalVisitors}</span>
                    </div>
                    <div class="stat-item">
                        <i class="icon-eye"></i>
                        <span>总访问: ${totalVisits}</span>
                    </div>
                    <div class="stat-item">
                        <i class="icon-location"></i>
                        <span>当前IP: ${this.currentVisitor.ip}</span>
                    </div>
                    <div class="stat-item">
                        <i class="icon-map-marker"></i>
                        <span>位置: ${this.currentVisitor.city}, ${this.currentVisitor.country}</span>
                    </div>
                </div>
            `;
        }
    }

    // 刷新地图
    refreshMap() {
        this.addVisitorMarkers();
    }

    // 清除所有数据
    clearData() {
        this.visitorData = [];
        this.saveVisitorData();
        this.refreshMap();
        this.updateDisplay();
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 尝试从Jekyll配置获取token
    let token = '{{ site.ipinfo.token }}';
    let tokenSource = 'Jekyll config';
    
    // 检查token是否被Jekyll正确处理（不是原始的模板字符串）
    if (token === '{{ site.ipinfo.token }}') {
        // 如果token没有被Jekyll处理，尝试从其他地方获取
        console.info('Jekyll template variable not processed, trying alternative methods...');
        
        // 方法1: 尝试从全局变量获取
        if (window.IPINFO_TOKEN) {
            token = window.IPINFO_TOKEN;
            tokenSource = 'global variable';
            console.info('✅ Using token from global variable');
        }
        // 方法2: 尝试从meta标签获取
        else {
            const metaToken = document.querySelector('meta[name="ipinfo-token"]');
            if (metaToken) {
                token = metaToken.getAttribute('content');
                tokenSource = 'meta tag';
                console.info('✅ Using token from meta tag');
            }
        }
    } else {
        console.info('✅ Using token from Jekyll configuration');
    }
    
    const ipinfoConfig = {
        token: token
    };

    // 验证token是否有效
    if (token && token !== '{{ site.ipinfo.token }}' && token.length > 10) {
        console.info(`IPinfo token found (source: ${tokenSource}), initializing map...`);
        setTimeout(() => {
            try {
                window.ipLocationMap = new IPLocationMap(ipinfoConfig);
                console.info('✅ IPLocationMap initialized successfully');
            } catch (error) {
                console.error('❌ Failed to initialize IPLocationMap:', error);
            }
        }, 500);
    } else {
        console.warn('⚠️ Invalid or missing IPinfo token. Please check your configuration.');
        console.info('Token value:', token);
        console.info('Token length:', token ? token.length : 0);
        console.info('Available sources:');
        console.info('- Jekyll config: {{ site.ipinfo.token }}');
        console.info('- Global variable: window.IPINFO_TOKEN');
        console.info('- Meta tag: <meta name="ipinfo-token" content="...">');
    }
}); 