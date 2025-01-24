export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/') {
      return handleHomePage();
    } else if (url.pathname === '/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    } else if (url.pathname === '/translate' && request.method === 'POST') {
      return handleTranslate(request, env);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  },
};

// 渲染首页 HTML
function handleHomePage() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>PDF 翻译服务</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; padding: 0; }
        form { margin-bottom: 20px; }
        .container { max-width: 600px; margin: auto; text-align: center; }
        .button { background-color: #007bff; color: white; border: none; padding: 10px 20px; cursor: pointer; }
        .button:hover { background-color: #0056b3; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>PDF 翻译服务</h1>
        <form id="upload-form">
          <label for="file">上传 PDF 文件:</label><br><br>
          <input type="file" id="file" name="file" accept=".pdf" required><br><br>
          <button type="submit" class="button">上传并翻译</button>
        </form>
        <p id="result"></p>
      </div>
      <script>
        const form = document.getElementById('upload-form');
        const result = document.getElementById('result');

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          result.textContent = "正在上传和翻译，请稍候...";

          const fileInput = document.getElementById('file');
          const formData = new FormData();
          formData.append('file', fileInput.files[0]);

          try {
            // 上传文件并翻译
            const response = await fetch('/upload', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) throw new Error('文件上传失败');
            const data = await response.json();
            result.textContent = "翻译结果: " + data.translation;
          } catch (err) {
            result.textContent = "发生错误: " + err.message;
          }
        });
      </script>
    </body>
    </html>
  `;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
}

// 处理文件上传
async function handleUpload(request, env) {
  const contentType = request.headers.get('content-type') || '';

  if (!contentType.includes('multipart/form-data')) {
    return new Response('Invalid upload request', { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || typeof file === 'string') {
    return new Response('No file uploaded', { status: 400 });
  }

  const fileName = `${Date.now()}_${file.name}`; // 生成唯一文件名

  // 将文件存储到 R2
  await env.BUCKET.put(fileName, file.stream());

  // 调用翻译逻辑
  const translation = await translatePdf(file, env);

  // 返回翻译结果
  return new Response(JSON.stringify({ message: 'Upload successful', translation }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
}

// 调用翻译 API 处理翻译
async function translatePdf(file, env) {
  // 模拟翻译内容（真实翻译需调用外部 API）
  const fileContent = await file.text(); // 简单提取文本，实际应处理 PDF
  const apiProvider = 'chatgpt'; // 假设使用 ChatGPT API
  const apiKey = env.CHATGPT_API_KEY;

  const response = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-davinci-003',
      prompt: `Translate the following PDF content to Chinese:\n\n${fileContent}`,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error('Translation API error');
  }

  const result = await response.json();
  return result.choices[0].text.trim();
}
