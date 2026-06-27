# -*- coding: utf-8 -*-
"""Tiny zero-dependency static server for the KhoyaPaya Command Center.
Rebuilds data.json, serves ./web, and opens the browser."""
import http.server, socketserver, os, webbrowser, threading, sys

HERE=os.path.dirname(os.path.abspath(__file__))
WEB=os.path.join(HERE,"web")
PORT=int(os.environ.get("PORT","8765"))

# (re)build data so the dashboard is always in sync with the CSVs
try:
    import build_data; build_data.main()
except Exception as e:
    print("[warn] data build skipped:",e)

os.chdir(WEB)
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
    def end_headers(self):
        self.send_header("Cache-Control","no-store"); super().end_headers()

def open_browser():
    webbrowser.open(f"http://127.0.0.1:{PORT}/index.html")

if __name__=="__main__":
    socketserver.TCPServer.allow_reuse_address=True
    with socketserver.TCPServer(("",PORT),H) as httpd:
        print(f"\n  KhoyaPaya Command Center  ->  http://127.0.0.1:{PORT}/index.html")
        print("  (Ctrl+C to stop)\n")
        threading.Timer(1.0,open_browser).start()
        try: httpd.serve_forever()
        except KeyboardInterrupt: print("\n  stopped.")
