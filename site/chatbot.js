// Pillar Construction assistant (chat widget)
// Talks to our own /api/chat server function. No API keys ever reach the browser,
// and replies are rendered as text (never raw HTML) so a model reply can't inject markup.
(function () {
  const ENDPOINT = '/api/chat';
  const SITE_PAGES = new Set([
    'home.html', 'portfolio.html', 'ourservices.html',
    'clienttestimonials.html', 'aboutus.html', 'contactus.html',
  ]);
  const history = [];

  // ── Styles ────────────────────────────────────────────────
  const css = `
    #pc-chatbot { position: fixed; right: 20px; bottom: 20px; z-index: 150; display: flex; flex-direction: column; align-items: flex-end; font-family: 'Geist', system-ui, -apple-system, sans-serif; }
    #pc-chat-window { display: none; flex-direction: column; width: min(360px, calc(100vw - 32px)); height: min(500px, calc(100dvh - 120px)); margin-bottom: 12px; background: #fffdf9; border-radius: 20px; box-shadow: 0 20px 60px -10px rgba(23,20,15,.35); overflow: hidden; border: 1px solid rgba(23,20,15,.1); }
    #pc-chat-window.pc-open { display: flex; }
    #pc-chat-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #17140f; color: #f6f1e8; }
    #pc-chat-header img { width: 34px; height: 34px; object-fit: contain; filter: invert(1); }
    #pc-chat-header strong { display: block; font-size: 14px; }
    #pc-chat-header span { font-size: 12px; color: rgba(246,241,232,.65); }
    #pc-chat-messages { flex: 1; overflow-y: auto; padding: 16px 14px; display: flex; flex-direction: column; gap: 10px; background: #f6f1e8; }
    .pc-msg { max-width: 86%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
    .pc-bot { align-self: flex-start; background: #fff; color: #17140f; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(23,20,15,.08); }
    .pc-user { align-self: flex-end; background: #a8451a; color: #fff; border-bottom-right-radius: 4px; }
    .pc-error { align-self: flex-start; background: #fbeee6; color: #8a3410; border: 1px solid #f0c7ae; }
    .pc-bot a { color: #8a3712; font-weight: 600; }
    .pc-typing { display: flex; gap: 4px; }
    .pc-typing i { width: 7px; height: 7px; border-radius: 50%; background: #b9ae9f; animation: pc-bounce 1.2s infinite; }
    .pc-typing i:nth-child(2) { animation-delay: .2s; } .pc-typing i:nth-child(3) { animation-delay: .4s; }
    @keyframes pc-bounce { 0%,60%,100% { transform: none; } 30% { transform: translateY(-5px); } }
    #pc-chat-form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid rgba(23,20,15,.08); background: #fffdf9; }
    #pc-chat-input { flex: 1; min-width: 0; border: 1px solid rgba(23,20,15,.2); border-radius: 999px; padding: 10px 14px; font: inherit; font-size: 14px; background: #f6f1e8; color: #17140f; }
    #pc-chat-input:focus { outline: none; border-color: #a8451a; box-shadow: 0 0 0 3px rgba(168,69,26,.15); }
    #pc-send-btn { border: 0; border-radius: 999px; padding: 0 16px; background: #a8451a; color: #fff; font: 600 14px inherit; font-family: inherit; cursor: pointer; }
    #pc-send-btn:disabled, #pc-chat-input:disabled { opacity: .55; cursor: default; }
    #pc-chat-toggle { width: 56px; height: 56px; border: 0; border-radius: 50%; background: #a8451a; color: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: 0 8px 24px rgba(168,69,26,.45); transition: transform .2s, background-color .2s; }
    #pc-chat-toggle:hover { background: #8a3712; transform: scale(1.06); }
    #pc-chat-toggle svg { width: 24px; height: 24px; }
    @media (prefers-reduced-motion: reduce) { .pc-typing i { animation: none; } #pc-chat-toggle { transition: none; } }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  // ── Markup ────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'pc-chatbot';
  root.innerHTML = `
    <section id="pc-chat-window" role="dialog" aria-label="Pillar Construction assistant">
      <header id="pc-chat-header">
        <img src="Pillar-Construction-Logo.png" alt="">
        <div><strong>Pillar Construction</strong><span>AI assistant · answers may be imperfect</span></div>
      </header>
      <div id="pc-chat-messages" aria-live="polite"></div>
      <form id="pc-chat-form">
        <label for="pc-chat-input" class="pc-sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Message</label>
        <input id="pc-chat-input" type="text" maxlength="1000" placeholder="Ask about our services…" autocomplete="off">
        <button id="pc-send-btn" type="submit">Send</button>
      </form>
    </section>
    <button id="pc-chat-toggle" type="button" aria-expanded="false" aria-controls="pc-chat-window" aria-label="Open chat">${ICON_CHAT}</button>
  `;
  document.body.appendChild(root);

  const win = root.querySelector('#pc-chat-window');
  const toggle = root.querySelector('#pc-chat-toggle');
  const list = root.querySelector('#pc-chat-messages');
  const form = root.querySelector('#pc-chat-form');
  const input = root.querySelector('#pc-chat-input');
  const send = root.querySelector('#pc-send-btn');

  // ── Rendering (safe) ──────────────────────────────────────
  // Text is inserted with textContent. The only markup we create is links written
  // as [text](page.html), and only when page.html is one of our own pages.
  function renderInto(el, text) {
    const re = /\[([^\]]{1,80})\]\(([a-z]+\.html)\)/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      el.append(text.slice(last, m.index));
      if (SITE_PAGES.has(m[2])) {
        const a = document.createElement('a');
        a.href = m[2];
        a.textContent = m[1];
        el.append(a);
      } else {
        el.append(m[1]);
      }
      last = re.lastIndex;
    }
    el.append(text.slice(last));
  }

  function addMessage(text, kind) {
    const div = document.createElement('div');
    div.className = 'pc-msg pc-' + kind;
    if (kind === 'bot') renderInto(div, text); else div.textContent = text;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    return div;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'pc-msg pc-bot';
    div.setAttribute('aria-label', 'Assistant is typing');
    div.innerHTML = '<span class="pc-typing"><i></i><i></i><i></i></span>';
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    return div;
  }

  function setBusy(busy) {
    input.disabled = busy;
    send.disabled = busy;
  }

  addMessage("Hi! I'm the Pillar Construction assistant. Ask me about our services, our history, or how to get a [free quote](contactus.html).", 'bot');

  // ── Sending ───────────────────────────────────────────────
  async function ask(text) {
    history.push({ role: 'user', content: text });
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.reply !== 'string') {
      history.pop(); // keep history valid so the visitor can retry
      if (res.status === 404 || res.status === 501) {
        throw new Error('The assistant only runs on the live site. You can always email Pillarcontractors@gmail.com.');
      }
      if (res.status === 429) throw new Error("You're sending messages quickly. Please wait a minute and try again.");
      throw new Error(data.error || 'Something went wrong. Please try again.');
    }
    history.push({ role: 'assistant', content: data.reply });
    return data.reply;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || input.disabled) return;
    addMessage(text, 'user');
    input.value = '';
    setBusy(true);
    const typing = showTyping();
    try {
      addMessage(await ask(text), 'bot');
    } catch (err) {
      addMessage(err.message, 'error');
    } finally {
      typing.remove();
      setBusy(false);
      input.focus();
    }
  });

  toggle.addEventListener('click', () => {
    const open = win.classList.toggle('pc-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
    toggle.innerHTML = open ? ICON_CLOSE : ICON_CHAT;
    if (open) input.focus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && win.classList.contains('pc-open')) toggle.click();
  });
})();
