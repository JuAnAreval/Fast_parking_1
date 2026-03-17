import http from 'node:http';
import handler from 'serve-handler';

const port = Number(process.env.PORT || 3000);

const server = http.createServer((request, response) => {
  return handler(request, response, {
    public: 'dist',
    rewrites: [{ source: '**', destination: '/index.html' }],
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Web server listening on http://0.0.0.0:${port}`);
});
