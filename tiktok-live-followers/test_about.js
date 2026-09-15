const axios = require('axios');
axios.get('http://localhost:3000/Codes/About.html')
  .then(r => {
    const html = r.data;
    const asiaMatch = html.match(/id="asiaRank"[^>]*>([^<]+)/);
    const worldMatch = html.match(/id="worldRank"[^>]*>([^<]+)/);
    const kzMatch = html.match(/id="kzRank"[^>]*>([^<]+)/);
    console.log('Asia rank display:', asiaMatch ? asiaMatch[1] : 'NOT FOUND');
    console.log('World rank display:', worldMatch ? worldMatch[1] : 'NOT FOUND');
    console.log('Kazakhstan rank display:', kzMatch ? kzMatch[1] : 'NOT FOUND');
  })
  .catch(e => console.error('Error:', e.message));