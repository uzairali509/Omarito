const http = require('http');
http.get({ hostname: 'localhost', port: 3000, path: '/Codes/About.html' }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const scriptTags = data.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
        scriptTags.forEach((s, i) => {
            const srcMatch = s.match(/src=["']([^"']+)["']/);
            if (srcMatch) {
                console.log('Script', i, ': src=' + srcMatch[1]);
            } else {
                console.log('Script', i, ': INLINE, length:', s.length);
            }
        });
    });
}).on('error', console.error);