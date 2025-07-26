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
        console.log('Initializing IPLocationMap...');
        
        // 先获取访客信息
        await this.getCurrentVisitorInfo();
        console.log('Visitor info obtained');
        
        // 等待DOM完全加载后再初始化地图
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initMap();
                this.updateDisplay();
            });
        } else {
            // DOM已经加载完成
            setTimeout(() => {
                this.initMap();
                this.updateDisplay();
            }, 100);
        }
    }

    // 获取当前访客信息
    async getCurrentVisitorInfo() {
        try {
            console.log('Fetching IP info with token:', this.ipinfoToken);
            
            const response = await fetch(`https://ipinfo.io/json?token=${this.ipinfoToken}`);
            console.log('IPinfo response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Raw IPinfo data:', data);
            
            // 验证数据完整性
            if (!data.ip) {
                throw new Error('No IP address in response');
            }
            
            const visitorInfo = {
                ip: data.ip || 'Unknown',
                city: data.city || 'Unknown',
                region: data.region || 'Unknown',
                country: data.country || 'Unknown',
                location: data.loc || '0,0', // "lat,lng" 格式
                timezone: data.timezone || 'Unknown',
                org: data.org || 'Unknown',
                timestamp: new Date().toISOString(),
                visitCount: 1
            };

            console.log('Processed visitor info:', visitorInfo);

            // 检查是否是新访客
            const existingVisitor = this.visitorData.find(v => v.ip === visitorInfo.ip);
            if (existingVisitor) {
                existingVisitor.visitCount++;
                existingVisitor.lastVisit = visitorInfo.timestamp;
                console.log('Existing visitor found, updated visit count');
            } else {
                this.visitorData.push(visitorInfo);
                console.log('New visitor added');
            }

            this.saveVisitorData();
            this.currentVisitor = visitorInfo;
            
            console.log('IP Location data:', visitorInfo);
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
        console.log('Initializing map...');
        
        if (this.map) {
            console.log('Removing existing map');
            this.map.remove();
        }

        // 创建地图容器
        const mapContainer = document.getElementById('visitor-map');
        if (!mapContainer) {
            console.error('Map container not found!');
            return;
        }

        console.log('Map container found:', mapContainer);

        // 设置地图容器样式
        mapContainer.style.height = '300px';
        mapContainer.style.width = '100%';
        mapContainer.style.borderRadius = '8px';
        mapContainer.style.overflow = 'hidden';

        try {
            // 初始化地图
            this.map = L.map('visitor-map').setView([0, 0], 2);
            console.log('Map initialized successfully');

            // 添加OpenStreetMap图层
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
            console.log('Tile layer added');

            // 添加所有访客标记
            this.addVisitorMarkers();
        } catch (error) {
            console.error('Error initializing map:', error);
        }
    }

    // 添加访客标记
    addVisitorMarkers() {
        console.log('Adding visitor markers, total visitors:', this.visitorData.length);
        
        // 清除现有标记
        this.markers.forEach(marker => marker.remove());
        this.markers = [];

        // 为每个访客添加标记
        this.visitorData.forEach((visitor, index) => {
            console.log(`Processing visitor ${index + 1}:`, visitor);
            
            if (visitor.location && visitor.location !== '0,0' && visitor.location !== 'Unknown') {
                try {
                    const [lat, lng] = visitor.location.split(',').map(Number);
                    
                    // 验证坐标有效性
                    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
                        console.warn(`Invalid coordinates for visitor ${index + 1}:`, visitor.location);
                        return;
                    }
                    
                    console.log(`Adding marker for visitor ${index + 1} at [${lat}, ${lng}]`);
                    
                    const marker = L.marker([lat, lng])
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
                    console.log(`Marker added successfully for visitor ${index + 1}`);
                } catch (error) {
                    console.error(`Error adding marker for visitor ${index + 1}:`, error);
                }
            } else {
                console.warn(`Skipping visitor ${index + 1} - no valid location:`, visitor.location);
            }
        });

        console.log(`Total markers added: ${this.markers.length}`);

        // 调整地图视图以显示所有标记
        if (this.markers.length > 0) {
            try {
                const group = new L.featureGroup(this.markers);
                this.map.fitBounds(group.getBounds().pad(0.1));
                console.log('Map bounds adjusted to show all markers');
            } catch (error) {
                console.error('Error adjusting map bounds:', error);
            }
        } else {
            console.log('No valid markers to display');
        }
    }

    // 更新显示
    updateDisplay() {
        this.updateVisitorStats();
        this.updateLocationInfo();
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
                    <div class="stat-item">
                        <i class="icon-clock"></i>
                        <span>时区: ${this.currentVisitor.timezone || 'Unknown'}</span>
                    </div>
                    <div class="stat-item">
                        <i class="icon-building"></i>
                        <span>组织: ${this.currentVisitor.org || 'Unknown'}</span>
                    </div>
                </div>
            `;
        }
    }

    // 更新位置信息（简化版本）
    updateLocationInfo() {
        // 位置信息现在直接显示在访客统计中
        this.updateVisitorStats();
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
    console.log('DOM loaded, initializing IPLocationMap...');
    
    // 从Jekyll配置中获取IPinfo设置
    const ipinfoConfig = {
        token: '{{ site.ipinfo.token }}'
    };

    console.log('IPinfo config:', ipinfoConfig);

    if (ipinfoConfig.token && ipinfoConfig.token !== '{{ site.ipinfo.token }}') {
        console.log('Valid token found, creating IPLocationMap...');
        // 延迟初始化，确保DOM完全加载
        setTimeout(() => {
            window.ipLocationMap = new IPLocationMap(ipinfoConfig);
        }, 500);
    } else {
        console.error('Invalid or missing IPinfo token:', ipinfoConfig.token);
    }
}); 