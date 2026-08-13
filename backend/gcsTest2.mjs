import http from "node:http"
import { Storage } from "@google-cloud/storage"

const seen = []
const server = http.createServer((req, res) => {
    let bytes = 0
    req.on("data", c => (bytes += c.length))
    req.on("end", () => {
        const range = req.headers["content-range"] ?? ""
        seen.push({ method: req.method, range, bytes, auth: req.headers.authorization ? "sent" : "none" })
        const m = /bytes (\d+)-(\d+)\/(\d+)/.exec(range)
        const done = m && Number(m[2]) === Number(m[3]) - 1
        if (done) { res.writeHead(200, {"content-type":"application/json"}); res.end(JSON.stringify({name:"src.zip",size:String(m[3])})) }
        else { res.writeHead(308, { Range: `bytes=0-${m ? m[2] : 0}` }); res.end() }
    })
})
await new Promise(r => server.listen(0, r))
const uri = `http://127.0.0.1:${server.address().port}/session`

const origin = new URL(uri).origin
const storage = new Storage({ projectId: "no-project", apiEndpoint: origin, useAuthWithCustomEndpoint: false })
const file = storage.bucket("no-bucket").file("no-key.zip")
const payload = Buffer.alloc(3 * 256 * 1024, 7)   // 768KB, 3 chunks at 256KB

await new Promise((resolve, reject) => {
    const stream = file.createWriteStream({ uri, chunkSize: 256 * 1024, resumable: true })
    stream.on("error", reject)
    stream.on("finish", resolve)
    stream.end(payload)
}).then(
    () => { console.log("UPLOAD OK, requests the server saw:"); seen.forEach(s => console.log("  ", s.method, s.range || "(no range)", "->", s.bytes, "bytes, auth header:", s.auth)) },
    e => { console.log("FAILED:", String(e.message).slice(0, 200)) }
)
server.close()
