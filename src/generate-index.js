#!/usr/bin/env node
/**
 * 生成订阅管理页面 index.html
 * 用法：node src/generate-index.js <outputDir> <repoOwner> <repoName> <timestamp>
 */

const fs = require('fs');
const path = require('path');

const outputDir = process.argv[2] || 'output';
const repoOwner = process.argv[3] || process.env.GITHUB_REPOSITORY_OWNER || 'unknown';
const repoName = process.argv[4] || process.env.GITHUB_REPOSITORY_NAME || 'calendar-subscription-tool';
const timestamp = process.argv[5] || new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

const repoFullName = `${repoOwner}/${repoName}`;
const repoUrl = `https://${repoOwner}.github.io/${repoName}`;

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>📅 日历订阅源</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height:100vh; padding:20px; }
        .container { max-width:800px; margin:0 auto; }
        .header-card { background:white; border-radius:20px; padding:40px; margin-bottom:20px; box-shadow:0 20px 60px rgba(0,0,0,0.3); text-align:center; }
        h1 { color:#667eea; margin-bottom:10px; font-size:28px; }
        .update-time { color:#999; font-size:14px; }
        .section-title { color:white; font-size:20px; font-weight:700; margin:30px 0 15px 5px; text-shadow:0 2px 4px rgba(0,0,0,0.2); }
        .card { background:white; border-radius:16px; padding:24px; margin-bottom:15px; border-left:5px solid #667eea; box-shadow:0 4px 12px rgba(0,0,0,0.1); transition:transform 0.2s, box-shadow 0.2s; }
        .card:hover { transform:translateX(6px); box-shadow:0 8px 20px rgba(0,0,0,0.15); }
        .card h3 { color:#333; margin-bottom:8px; font-size:17px; }
        .card p { color:#666; font-size:14px; margin-bottom:14px; line-height:1.5; }
        .card.a-allinone { border-left-color:#48bb78; background:linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%); }
        .subscription-url { background:#f8f9fa; border:2px solid #e9ecef; border-radius:10px; padding:12px 16px; font-family:'Courier New',monospace; font-size:13px; color:#667eea; word-break:break-all; cursor:pointer; transition:all 0.2s; user-select:all; }
        .subscription-url:hover { background:#e7f0ff; border-color:#667eea; }
        .badge { display:inline-block; background:#667eea; color:white; padding:3px 10px; border-radius:12px; font-size:11px; margin-left:8px; font-weight:600; vertical-align:middle; }
        .btn { display:inline-block; padding:14px 32px; border-radius:12px; text-decoration:none; font-weight:600; font-size:15px; transition:all 0.2s; cursor:pointer; border:none; }
        .btn-primary { background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; box-shadow:0 4px 12px rgba(102,126,234,0.4); }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(102,126,234,0.5); }
        .btn-secondary { background:white; color:#667eea; border:2px solid #667eea; }
        .btn-secondary:hover { background:#667eea; color:white; }
        .guide-card { background:white; border-radius:16px; padding:30px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
        .guide-card h2 { color:#667eea; margin-bottom:20px; font-size:22px; }
        .step { display:flex; margin-bottom:20px; align-items:flex-start; }
        .step-num { background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:16px; flex-shrink:0; margin-right:16px; margin-top:2px; }
        .step-content { flex:1; }
        .step-content h4 { color:#333; margin-bottom:6px; font-size:15px; }
        .step-content p { color:#666; font-size:14px; line-height:1.6; }
        code { background:#f0f0f0; padding:2px 8px; border-radius:4px; font-size:13px; color:#d63384; }
        .config-preview { background:#1e1e1e; color:#d4d4d4; padding:20px; border-radius:10px; font-family:'Courier New',monospace; font-size:13px; overflow-x:auto; margin-top:12px; line-height:1.6; }
        .config-preview .key { color:#9cdcfe; }
        .config-preview .string { color:#ce9178; }
        .config-preview .boolean { color:#569cd6; }
        .config-preview .comment { color:#6a9955; }
        .tab-bar { display:flex; border-bottom:2px solid rgba(255,255,255,0.3); margin-bottom:20px; }
        .tab { padding:12px 24px; cursor:pointer; color:rgba(255,255,255,0.7); font-weight:500; border-bottom:2px solid transparent; margin-bottom:-2px; transition:all 0.2s; }
        .tab.active { color:white; border-bottom-color:white; font-weight:600; }
        .tab-content { display:none; }
        .tab-content.active { display:block; }
        .copy-toast { position:fixed; bottom:30px; left:50%; transform:translateX(-50%) translateY(100px); background:#333; color:white; padding:12px 24px; border-radius:10px; font-size:14px; transition:transform 0.3s; z-index:999; }
        .copy-toast.show { transform:translateX(-50%) translateY(0); }
        .footer { text-align:center; color:rgba(255,255,255,0.8); font-size:13px; margin-top:30px; padding-bottom:20px; }
        .footer a { color:white; text-decoration:underline; }
        ul { color:#666; font-size:14px; line-height:1.8; margin-top:8px; padding-left:20px; }
    </style>
</head>
<body>
    <div class="container">
        <!-- 头部 -->
        <div class="header-card">
            <h1>📅 日历订阅源</h1>
            <div class="update-time">🕐 最后更新: ${timestamp}</div>
        </div>

        <!-- 标签栏 -->
        <div class="tab-bar">
            <div class="tab active" onclick="switchTab('subscribe')">📡 订阅日历</div>
            <div class="tab" onclick="switchTab('customize')">⚙️ 定制我的日历</div>
        </div>

        <!-- 订阅标签页 -->
        <div id="tab-subscribe" class="tab-content active">
            <div class="section-title">🇨🇳 中国节假日 <span class="badge">推荐</span></div>
            <div class="card">
                <h3>🇨🇳 中国节假日</h3>
                <p>国务院办公厅发布的法定节假日 + 调休安排</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}/china-holidays.ics</div>
            </div>

            <div class="section-title">🌙 农历 · 节气 · 宜忌</div>
            <div class="card">
                <h3>🌙 农历日历</h3>
                <p>农历日期 + 传统节日（春节、中秋、端午等）</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}/lunar-calendar.ics</div>
            </div>
            <div class="card">
                <h3>☀️ 二十四节气</h3>
                <p>完整二十四节气，精准到分钟</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}/solar-terms.ics</div>
            </div>
            <div class="card">
                <h3>📋 宜忌日历</h3>
                <p>每日宜忌 + 吉神凶煞（传统黄历）</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}/yi-ji.ics</div>
            </div>

            <div class="section-title">🎉 节日 · 全能</div>
            <div class="card">
                <h3>🎉 普通节日</h3>
                <p>公历节日 + 国际节日 + 动态日期节日</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}/festivals.ics</div>
            </div>
            <div class="card a-allinone">
                <h3>🚀 全能日历 <span class="badge" style="background:#48bb78;">ALL-IN-ONE</span></h3>
                <p>合并所有日历源，一个订阅搞定所有</p>
                <div class="subscription-url" onclick="copyToClipboard(this)">${repoUrl}/all-in-one.ics</div>
            </div>
        </div>

        <!-- 定制标签页 -->
        <div id="tab-customize" class="tab-content">
            <div class="guide-card">
                <h2>⚙️ 定制我的日历</h2>
                <p style="color:#666; margin-bottom:24px; line-height:1.6;">通过以下步骤，创建属于你自己的定制版日历订阅源：</p>

                <div class="step">
                    <div class="step-num">1</div>
                    <div class="step-content">
                        <h4>创建你的副本</h4>
                        <p>点击下面的按钮，一键创建你的专属日历仓库（无需手动配置）</p>
                        <a href="https://github.com/new?template=${repoFullName}" target="_blank" class="btn btn-primary" style="margin-top:8px;">🚀 创建我的日历副本</a>
                    </div>
                </div>

                <div class="step">
                    <div class="step-num">2</div>
                    <div class="step-content">
                        <h4>定制配置（可选）</h4>
                        <p>在你的仓库中编辑 <code>config.json</code>，可以：</p>
                        <ul>
                            <li>修改节假日数据源（支持 timor.tech 格式或自定义 API）</li>
                            <li>选择要合并的订阅源（all-in-one.ics 的内容）</li>
                            <li>开启/关闭中国节日、国际节日、动态节日</li>
                            <li>添加自定义节日</li>
                        </ul>
                        <div style="margin-top:12px;">
                            <a href="https://github.com/${repoFullName}/edit/main/config.json" target="_blank" class="btn btn-secondary" style="margin-right:10px;">✏️ 在线编辑 config.json</a>
                            <a href="#config-guide" onclick="document.getElementById('tab-customize').scrollTop=0;return false;" class="btn btn-secondary">📖 查看配置说明</a>
                        </div>
                    </div>
                </div>

                <div class="step">
                    <div class="step-num">3</div>
                    <div class="step-content">
                        <h4>启用自动更新</h4>
                        <p>进入你的仓库 → <strong>Settings</strong> → <strong>Pages</strong> → Source 选择 <strong>GitHub Actions</strong></p>
                        <p style="margin-top:8px;">然后进入 <strong>Actions</strong> 标签 → 选择 <strong>Generate & Deploy Calendar</strong> → <strong>Run workflow</strong></p>
                    </div>
                </div>

                <div class="step">
                    <div class="step-num">4</div>
                    <div class="step-content">
                        <h4>获取你的专属订阅链接</h4>
                        <p>部署成功后，你的专属订阅链接为：</p>
                        <div class="subscription-url" style="margin-top:8px;" onclick="copyToClipboard(this)">https://你的用户名.github.io/你的仓库名/all-in-one.ics</div>
                        <p style="margin-top:12px; color:#999; font-size:13px;">💡 将 <code>all-in-one.ics</code> 替换为 <code>china-holidays.ics</code> 等可获取其他订阅源</p>
                    </div>
                </div>
            </div>

            <!-- 配置说明 -->
            <div class="guide-card" id="config-guide-card">
                <h2>📖 config.json 配置说明</h2>
                <div class="config-preview"><span class="key">"holidayApi"</span>: <span class="string">"https://timor.tech/api/holiday/year/{{year}}"</span>,  <span class="comment">// 自定义节假日 API 地址</span>
<span class="key">"holidayApiFormat"</span>: <span class="string">"timor"</span>,                        <span class="comment">// API 格式: "timor" 或 "simple"</span>
<span class="key">"mergeSources"</span>: [                                      <span class="comment">// all-in-one.ics 合并的源</span>
  <span class="string">"output/china-holidays.ics"</span>,
  <span class="string">"output/lunar-calendar.ics"</span>,
  <span class="string">"output/solar-terms.ics"</span>,
  <span class="string">"output/festivals.ics"</span>
],
<span class="key">"festivals"</span>: {
  <span class="key">"includeCN"</span>: <span class="boolean">true</span>,         <span class="comment">// 包含中国公历节日</span>
  <span class="key">"includeIntl"</span>: <span class="boolean">true</span>,     <span class="comment">// 包含国际/西方节日</span>
  <span class="key">"includeDynamic"</span>: <span class="boolean">true</span>,  <span class="comment">// 包含动态日期节日</span>
  <span class="key">"custom"</span>: []                              <span class="comment">// 自定义节日</span>
}</div>
                <p style="color:#666; font-size:13px; margin-top:16px; line-height:1.6;">
                    💡 <strong>提示</strong>：编辑完成后，GitHub Actions 会自动运行并更新你的订阅源。也可在 Actions 页面手动点击 <strong>Run workflow</strong> 立即触发。
                </p>
            </div>
        </div>

        <div class="footer">
            <p>🤖 由 GitHub Actions 自动生成 | 每天北京时间凌晨2点自动更新</p>
            <p style="margin-top:8px;">💡 点击订阅链接可复制 | <a href="https://github.com/${repoFullName}" target="_blank">GitHub 仓库</a> | <a href="#" onclick="switchTab('customize');return false;">定制我的日历</a></p>
        </div>
    </div>

    <div class="copy-toast" id="copyToast">✅ 已复制到剪贴板！</div>

    <script>
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            if (tabName === 'subscribe') {
                document.querySelectorAll('.tab')[0].classList.add('active');
                document.getElementById('tab-subscribe').classList.add('active');
            } else {
                document.querySelectorAll('.tab')[1].classList.add('active');
                document.getElementById('tab-customize').classList.add('active');
            }
        }
        function copyToClipboard(element) {
            const text = element.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const toast = document.getElementById('copyToast');
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 2000);
            });
        }
    </script>
</body>
</html>`;

const outputPath = path.join(outputDir, 'index.html');
fs.writeFileSync(outputPath, html, 'utf8');
console.log(`✅ index.html 已生成: ${outputPath}`);
