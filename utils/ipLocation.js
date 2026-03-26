// IP 地区查询工具
// 使用 ip-api.com 免费版（非商业用途，每秒 45 次限制）

const https = require('https');

// 缓存 IP 查询结果，避免重复请求
const ipCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

/**
 * 查询 IP 地区信息
 * @param {string} ip - IP 地址
 * @returns {Promise<{country:string, region:string, city:string, isp:string}>}
 */
async function getIPLocation(ip) {
    // 处理内网 IP
    if (isPrivateIP(ip)) {
        return { country: '本地', region: '内网', city: '-', isp: '-' };
    }
    
    // 检查缓存
    const cached = ipCache.get(ip);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data;
    }
    
    try {
        // 使用 ip-api.com (免费，无需 key)
        const data = await fetchFromIPApi(ip);
        
        // 缓存结果
        ipCache.set(ip, { data, time: Date.now() });
        
        return data;
    } catch (error) {
        console.error('IP 查询失败:', error.message);
        return { country: '-', region: '-', city: '-', isp: '-' };
    }
}

/**
 * 从 ip-api.com 获取 IP 信息
 */
function fetchFromIPApi(ip) {
    return new Promise((resolve, reject) => {
        // 移除 IPv6 前缀
        const cleanIP = ip.replace(/^::ffff:/, '');
        
        const url = `http://ip-api.com/json/${cleanIP}?fields=status,country,regionName,city,isp&lang=zh-CN`;
        
        const req = https.get(url, {
            timeout: 5000,
            headers: {
                'User-Agent': 'Wujie-Tea-Backend'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'success') {
                        resolve({
                            country: json.country || '-',
                            region: json.regionName || '-',
                            city: json.city || '-',
                            isp: json.isp || '-'
                        });
                    } else {
                        reject(new Error(json.message || '查询失败'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
    });
}

/**
 * 判断是否为内网 IP
 */
function isPrivateIP(ip) {
    if (!ip) return true;
    
    // 移除 IPv6 前缀
    ip = ip.replace(/^::ffff:/, '');
    
    // 本地回环
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return true;
    }
    
    // 内网段
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    const [a, b, c, d] = parts.map(Number);
    
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    
    return false;
}

/**
 * 格式化地区显示
 */
function formatLocation(location) {
    if (!location) return '-';
    const { country, region, city } = location;
    if (country === '本地' || country === '-') return country;
    return `${country} ${region} ${city}`.replace(/\s+/g, ' ').trim();
}

module.exports = {
    getIPLocation,
    formatLocation,
    isPrivateIP
};