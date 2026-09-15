const axios = require('axios');
axios.get('http://localhost:3000/')
  .then(r => {
    const html = r.data;
    const followersMatch = html.match(/id="followersCount"[^>]*>([^<]+)/);
    const likesMatch = html.match(/id="likesCount"[^>]*>([^<]+)/);
    console.log('Homepage Followers:', followersMatch ? followersMatch[1] : 'NOT FOUND');
    console.log('Homepage Likes:', likesMatch ? likesMatch[1] : 'NOT FOUND');
  })
  .catch(e => console.error('Error:', e.message));