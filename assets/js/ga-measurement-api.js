// Google Analytics Measurement Protocol API 访问脚本
class GAMeasurementAPI {
    constructor(config) {
        this.measurementId = config.measurement_id;
        this.apiSecret = config.api_secret;
        this.streamName = config.stream_name;
        this.endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;
    }

    // 发送页面浏览事件
    async sendPageView(pageTitle, pageLocation) {
        const eventData = {
            client_id: this.getClientId(),
            events: [{
                name: 'page_view',
                params: {
                    page_title: pageTitle,
                    page_location: pageLocation,
                    engagement_time_msec: 100
                }
            }]
        };

        try {
            // 使用navigator.sendBeacon避免CORS问题
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(eventData)], {
                    type: 'application/json'
                });
                const success = navigator.sendBeacon(this.endpoint, blob);
                
                if (success) {
                    console.log('GA Measurement Protocol: Page view sent successfully via sendBeacon');
                    this.updateLocalStats();
                } else {
                    console.warn('GA Measurement Protocol: sendBeacon failed, falling back to fetch');
                    await this.sendWithFetch(eventData);
                }
            } else {
                // 降级到fetch
                await this.sendWithFetch(eventData);
            }
        } catch (error) {
            console.error('GA Measurement Protocol: Error sending data', error);
        }
    }

    // 获取客户端ID
    getClientId() {
        let clientId = localStorage.getItem('ga_client_id');
        if (!clientId) {
            clientId = 'client_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('ga_client_id', clientId);
        }
        return clientId;
    }

    // 更新本地统计显示
    updateLocalStats() {
        const pageViews = parseInt(localStorage.getItem('ga_page_views') || '0') + 1;
        localStorage.setItem('ga_page_views', pageViews.toString());
        
        // 更新显示
        this.updateDisplay(pageViews);
    }

    // 更新显示
    updateDisplay(pageViews) {
        const displayElement = document.getElementById('ga-stats-display');
        if (displayElement) {
            displayElement.innerHTML = `
                <div class="ga-stats">
                    <div class="stat-item">
                        <i class="icon-eye"></i>
                        <span>页面访问: ${pageViews}</span>
                    </div>
                    <div class="stat-item">
                        <i class="icon-user"></i>
                        <span>访客ID: ${this.getClientId().substr(0, 8)}...</span>
                    </div>
                </div>
            `;
        }
    }

    // 使用fetch发送数据（降级方法）
    async sendWithFetch(eventData) {
        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData)
            });
            
            if (response.ok) {
                console.log('GA Measurement Protocol: Data sent successfully via fetch');
                return true;
            } else {
                console.error('GA Measurement Protocol: Failed to send data via fetch');
                return false;
            }
        } catch (error) {
            console.error('GA Measurement Protocol: Error sending data via fetch', error);
            return false;
        }
    }

    // 发送自定义事件
    async sendCustomEvent(eventName, parameters = {}) {
        const eventData = {
            client_id: this.getClientId(),
            events: [{
                name: eventName,
                params: parameters
            }]
        };

        try {
            // 使用navigator.sendBeacon避免CORS问题
            if (navigator.sendBeacon) {
                const blob = new Blob([JSON.stringify(eventData)], {
                    type: 'application/json'
                });
                const success = navigator.sendBeacon(this.endpoint, blob);
                
                if (success) {
                    console.log(`GA Measurement Protocol: Custom event '${eventName}' sent successfully via sendBeacon`);
                } else {
                    console.warn(`GA Measurement Protocol: sendBeacon failed for '${eventName}', falling back to fetch`);
                    await this.sendWithFetch(eventData);
                }
            } else {
                // 降级到fetch
                await this.sendWithFetch(eventData);
            }
        } catch (error) {
            console.error('GA Measurement Protocol: Error sending custom event', error);
        }
    }
}

// 初始化GA Measurement API
document.addEventListener('DOMContentLoaded', function() {
    // 从Jekyll配置中获取GA设置
    let measurementId = '{{ site.ga_measurement_protocol.measurement_id }}';
    let apiSecret = '{{ site.ga_measurement_protocol.api_secret }}';
    let streamName = '{{ site.ga_measurement_protocol.stream_name }}';
    
    // 检查Jekyll模板变量是否被正确处理
    if (measurementId === '{{ site.ga_measurement_protocol.measurement_id }}' || 
        apiSecret === '{{ site.ga_measurement_protocol.api_secret }}') {
        console.info('GA Measurement Protocol: Jekyll template variables not processed, trying alternative methods...');
        
        // 尝试从全局变量获取配置
        if (window.GA_CONFIG) {
            measurementId = window.GA_CONFIG.measurement_id;
            apiSecret = window.GA_CONFIG.api_secret;
            streamName = window.GA_CONFIG.stream_name;
            console.info('✅ GA Measurement Protocol: Using configuration from global variable');
        }
    } else {
        console.info('✅ GA Measurement Protocol: Using configuration from Jekyll');
    }
    
    // 验证配置是否有效
    if (!measurementId || !apiSecret || measurementId.length < 10 || apiSecret.length < 10) {
        console.warn('GA Measurement Protocol: Invalid configuration, skipping GA API initialization');
        console.log('Measurement ID:', measurementId);
        console.log('API Secret length:', apiSecret ? apiSecret.length : 0);
        return;
    }
    
    const gaConfig = {
        measurement_id: measurementId,
        api_secret: apiSecret,
        stream_name: streamName
    };

    try {
        const gaAPI = new GAMeasurementAPI(gaConfig);
        
        // 将实例保存到全局变量，供测试使用
        window.gaAPI = gaAPI;
        
        // 发送页面浏览事件（使用navigator.sendBeacon避免CORS问题）
        gaAPI.sendPageView(document.title, window.location.href);
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                gaAPI.sendCustomEvent('page_focus', {
                    page_title: document.title,
                    page_location: window.location.href
                });
            }
        });

        // 监听页面卸载
        window.addEventListener('beforeunload', function() {
            gaAPI.sendCustomEvent('page_exit', {
                page_title: document.title,
                page_location: window.location.href,
                engagement_time_msec: Date.now() - performance.timing.navigationStart
            });
        });
        
        console.log('GA Measurement Protocol: Initialized successfully');
    } catch (error) {
        console.error('GA Measurement Protocol: Initialization failed', error);
    }
}); 