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
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData)
            });
            
            if (response.ok) {
                console.log('GA Measurement Protocol: Page view sent successfully');
                this.updateLocalStats();
            } else {
                console.error('GA Measurement Protocol: Failed to send page view');
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
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData)
            });
            
            if (response.ok) {
                console.log(`GA Measurement Protocol: Custom event '${eventName}' sent successfully`);
            } else {
                console.error(`GA Measurement Protocol: Failed to send event '${eventName}'`);
            }
        } catch (error) {
            console.error('GA Measurement Protocol: Error sending custom event', error);
        }
    }
}

// 初始化GA Measurement API
document.addEventListener('DOMContentLoaded', function() {
    // 从Jekyll配置中获取GA设置
    const gaConfig = {
        measurement_id: '{{ site.ga_measurement_protocol.measurement_id }}',
        api_secret: '{{ site.ga_measurement_protocol.api_secret }}',
        stream_name: '{{ site.ga_measurement_protocol.stream_name }}'
    };

    if (gaConfig.measurement_id && gaConfig.api_secret) {
        const gaAPI = new GAMeasurementAPI(gaConfig);
        
        // 发送页面浏览事件
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
    }
}); 