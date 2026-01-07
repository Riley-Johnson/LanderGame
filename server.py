#!/usr/bin/env python3
import http.server
import socketserver

PORT = 9999

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Required headers for SharedArrayBuffer
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        # Use 'credentialless' to allow loading from CDNs without CORP headers
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        # Disable caching for development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
    print(f"Server running at http://localhost:{PORT}/")
    print("Press Ctrl+C to stop")
    httpd.serve_forever()
