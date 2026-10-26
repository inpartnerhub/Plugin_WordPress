/**
 * WP Knowledge Chat widget (vanilla JS, no dependencies).
 *
 * Security notes:
 * - All dynamic text is inserted with textContent; innerHTML is never used for content.
 * - Links are rendered only for https URLs on hosts approved by the server config.
 * - The widget talks only to the same-origin WordPress REST endpoint.
 */
(function () {
	'use strict';

	var STORAGE_KEY = 'wkc-history-v1';
	var LANG_KEY = 'wkc-lang';
	var MAX_HISTORY = 30;
	// Longer than the WordPress-to-backend timeout (Backend_Client::TIMEOUT_SECONDS, 22 s), so the
	// visitor sees WordPress's localized error rather than a generic abort.
	var REQUEST_TIMEOUT_MS = 30000;

	var STRINGS = {
		en: {
			title: 'Inpartner AI Assistant',
			subtitle: 'Inpartner Assistant',
			open: 'Open the Inpartner AI assistant',
			close: 'Close chat',
			language: 'Language',
			inputLabel: 'Type your question',
			placeholder: 'Ask something…',
			send: 'Send',
			suggestions: 'Suggested questions',
			you: 'You said:',
			assistant: 'Assistant said:',
			typing: 'The assistant is preparing an answer…',
			analyzing: 'Searching Inpartner knowledge base…',
			formulating: 'Preparing business consultation answer…',
			received: 'New answer received.',
			sources: 'Sources',
			newTab: '(opens in a new tab)',
			contact: 'Contact the Inpartner team',
			contactPrompt: 'Need a specific answer? Contact the Inpartner team',
			errorLabel: 'Error:',
			retry: 'Try again',
			disclaimer: 'AI can make mistakes. Please verify important information.',
			tooLong: 'Your question is too long. Please keep it under {max} characters.',
			empty: 'Please type a question first.',
			errNetwork: 'The assistant could not be reached. Please check your connection and try again.',
			errTimeout: 'The assistant is taking too long to respond. Please try again.',
			errRate: 'You are sending messages too quickly. Please wait a minute and try again.',
			errGeneric: 'The assistant is unavailable right now. Please try again later or contact us directly.',
			counter: '{n} of {max} characters',
			clear: 'Clear chat',
			requestConsult: 'Request Consultation',
			leadName: 'Your Name',
			leadEmail: 'Work Email',
			leadCompany: 'Company (Optional)',
			leadMessage: 'Consultation Inquiry',
			leadSubmit: 'Send Request',
			leadCancel: 'Cancel',
			leadSuccess: 'Thank you! Your consultation request has been sent to the Inpartner team.',
			leadError: 'Please provide a valid name and email address.',
			leadFailed: 'Your request could not be sent. Please try again later or use the contact link.',
			leadPrivacy: 'Your details are sent to the Inpartner team only to answer this request.',
			online: 'Online',
			launcherBadge: 'Chat with Inpartner',
			quickTitle: 'What would you like to do?',
			quickActions: 'Quick actions',
			quickQuestions: 'Quick questions',
			editQuestion: 'Edit question',
			edit: 'Edit',
			viewDetails: 'View Service Details'
		},
		id: {
			title: 'Asisten AI Inpartner',
			subtitle: 'Inpartner Assistant',
			open: 'Buka asisten AI Inpartner',
			close: 'Tutup obrolan',
			language: 'Bahasa',
			inputLabel: 'Tulis pertanyaan Anda',
			placeholder: 'Tanyakan sesuatu…',
			send: 'Kirim',
			suggestions: 'Pertanyaan yang disarankan',
			you: 'Anda:',
			assistant: 'Asisten:',
			typing: 'Asisten sedang menyiapkan jawaban…',
			analyzing: 'Menganalisis basis pengetahuan Inpartner…',
			formulating: 'Menyusun jawaban konsultasi bisnis…',
			received: 'Jawaban baru diterima.',
			sources: 'Sumber',
			newTab: '(terbuka di tab baru)',
			contact: 'Hubungi tim Inpartner',
			contactPrompt: 'Butuh jawaban spesifik? Hubungi tim Inpartner',
			errorLabel: 'Galat:',
			retry: 'Coba lagi',
			disclaimer: 'AI dapat membuat kesalahan. Harap periksa kembali informasi penting.',
			tooLong: 'Pertanyaan terlalu panjang. Maksimal {max} karakter.',
			empty: 'Silakan tulis pertanyaan terlebih dahulu.',
			errNetwork: 'Asisten tidak dapat dihubungi. Periksa koneksi Anda lalu coba lagi.',
			errTimeout: 'Asisten terlalu lama merespons. Silakan coba lagi.',
			errRate: 'Anda mengirim pesan terlalu cepat. Silakan tunggu sebentar lalu coba lagi.',
			errGeneric: 'Asisten sedang tidak tersedia. Silakan coba lagi nanti atau hubungi kami secara langsung.',
			counter: '{n} dari {max} karakter',
			clear: 'Hapus obrolan',
			requestConsult: 'Jadwalkan Konsultasi',
			leadName: 'Nama Anda',
			leadEmail: 'Email Kerja',
			leadCompany: 'Perusahaan (Opsional)',
			leadMessage: 'Kebutuhan Konsultasi',
			leadSubmit: 'Kirim Permintaan',
			leadCancel: 'Batal',
			leadSuccess: 'Terima kasih! Permintaan konsultasi Anda telah dikirim ke tim Inpartner.',
			leadError: 'Silakan isi nama dan alamat email yang valid.',
			leadFailed: 'Permintaan Anda tidak dapat dikirim. Silakan coba lagi nanti atau gunakan tautan kontak.',
			leadPrivacy: 'Data Anda hanya dikirim ke tim Inpartner untuk menanggapi permintaan ini.',
			online: 'Online',
			launcherBadge: 'Chat dengan Inpartner',
			quickTitle: 'Apa yang ingin Anda lakukan?',
			quickActions: 'Aksi cepat',
			quickQuestions: 'Pertanyaan cepat',
			editQuestion: 'Ubah pertanyaan',
			edit: 'Ubah',
			viewDetails: 'Lihat Detail Layanan'
		},
		ko: {
			title: 'Inpartner AI 어시스턴트',
			subtitle: 'Inpartner Assistant',
			open: 'Inpartner AI 어시스턴트 열기',
			close: '채팅 닫기',
			language: '언어',
			inputLabel: '질문을 입력하세요',
			placeholder: '질문을 입력하세요…',
			send: '보내기',
			suggestions: '추천 질문',
			you: '나:',
			assistant: '어시스턴트:',
			typing: '어시스턴트가 답변을 준비하고 있습니다…',
			analyzing: 'Inpartner 지식 베이스 확인 중…',
			formulating: '비즈니스 자문 답변 작성 중…',
			received: '새 답변이 도착했습니다.',
			sources: '출처',
			newTab: '(새 탭에서 열림)',
			contact: 'Inpartner 팀에 문의하기',
			contactPrompt: '구체적인 답변이 필요하신가요? Inpartner 팀에 문의하세요',
			errorLabel: '오류:',
			retry: '다시 시도',
			disclaimer: 'AI는 실수를 할 수 있습니다. 중요한 정보를 재확인하세요.',
			tooLong: '질문이 너무 깁니다. {max}자 이내로 입력해 주세요.',
			empty: '먼저 질문을 입력해 주세요.',
			errNetwork: '어시스턴트에 연결할 수 없습니다. 인터넷 연결을 확인한 후 다시 시도해 주세요.',
			errTimeout: '어시스턴트의 응답이 너무 늦어지고 있습니다. 다시 시도해 주세요.',
			errRate: '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요.',
			errGeneric: '지금은 어시스턴트를 이용할 수 없습니다. 잠시 후 다시 시도하시거나 직접 문의해 주세요.',
			counter: '{n} / {max}자',
			clear: '대화 지우기',
			requestConsult: '상담 요청하기',
			leadName: '성함',
			leadEmail: '이메일',
			leadCompany: '회사명 (선택)',
			leadMessage: '상담 문의 내용',
			leadSubmit: '요청 보내기',
			leadCancel: '취소',
			leadSuccess: '감사합니다! Inpartner 자문팀으로 상담 요청이 전송되었습니다.',
			leadError: '올바른 성함과 이메일 주소를 입력해 주세요.',
			leadFailed: '요청을 보낼 수 없습니다. 잠시 후 다시 시도하시거나 연락처 링크를 이용해 주세요.',
			leadPrivacy: '입력하신 정보는 본 상담 문의에 답변하기 위한 목적으로만 Inpartner 자문팀에 전달됩니다.',
			online: '온라인',
			launcherBadge: 'Inpartner와 채팅하기',
			quickTitle: '어떤 도움이 필요하신가요?',
			quickActions: '빠른 작업',
			quickQuestions: '빠른 질문',
			editQuestion: '질문 수정',
			edit: '수정',
			viewDetails: '서비스 상세 보기'
		},
		ja: {
			title: 'Inpartner AIアシスタント',
			subtitle: 'Inpartner Assistant',
			open: 'Inpartner AIアシスタントを開く',
			close: 'チャットを閉じる',
			language: '言語',
			inputLabel: '質問を入力してください',
			placeholder: '質問を入力してください…',
			send: '送信',
			suggestions: 'おすすめの質問',
			you: 'あなた:',
			assistant: 'アシスタント:',
			typing: 'アシスタントが回答を準備しています…',
			analyzing: 'Inpartnerのナレッジベースを確認中…',
			formulating: 'ビジネスアドバイザリーの回答を作成中…',
			received: '新しい回答が届きました。',
			sources: '出典',
			newTab: '（新しいタブで開きます）',
			contact: 'Inpartnerチームに問い合わせる',
			contactPrompt: '具体的な回答が必要ですか？Inpartnerチームにお問い合わせください',
			errorLabel: 'エラー:',
			retry: '再試行',
			disclaimer: 'AIは間違えることがあります。重要な情報はご確認ください。',
			tooLong: '質問が長すぎます。{max}文字以内で入力してください。',
			empty: 'まず質問を入力してください。',
			errNetwork: 'アシスタントに接続できません。インターネット接続を確認して再度お試しください。',
			errTimeout: 'アシスタントの応答に時間がかかっています。再度お試しください。',
			errRate: 'メッセージの送信が速すぎます。少し待ってから再度お試しください。',
			errGeneric: '現在アシスタントをご利用いただけません。しばらくしてから再度お試しいただくか、直接お問い合わせください。',
			counter: '{n} / {max}文字',
			clear: '会話を消去',
			requestConsult: '相談をリクエスト',
			leadName: 'お名前',
			leadEmail: 'メールアドレス',
			leadCompany: '会社名（任意）',
			leadMessage: 'ご相談内容',
			leadSubmit: 'リクエストを送信',
			leadCancel: 'キャンセル',
			leadSuccess: 'ありがとうございます！ご相談のリクエストをInpartnerチームに送信しました。',
			leadError: '有効なお名前とメールアドレスを入力してください。',
			leadFailed: 'リクエストを送信できませんでした。しばらくしてから再度お試しいただくか、連絡先リンクをご利用ください。',
			leadPrivacy: 'ご入力いただいた情報は、このご相談への回答のためにのみInpartnerチームに共有されます。',
			online: 'オンライン',
			launcherBadge: 'Inpartnerとチャット',
			quickTitle: 'どのようなご用件ですか？',
			quickActions: 'クイックアクション',
			quickQuestions: 'よくある質問',
			editQuestion: '質問を編集',
			edit: '編集',
			viewDetails: 'サービスの詳細を見る'
		},
		zh: {
			title: 'Inpartner AI 助手',
			subtitle: 'Inpartner Assistant',
			open: '打开 Inpartner AI 助手',
			close: '关闭聊天',
			language: '语言',
			inputLabel: '请输入您的问题',
			placeholder: '请输入您的问题…',
			send: '发送',
			suggestions: '推荐问题',
			you: '您：',
			assistant: '助手：',
			typing: '助手正在准备回答…',
			analyzing: '正在查询 Inpartner 知识库…',
			formulating: '正在撰写商业咨询回答…',
			received: '收到新回答。',
			sources: '来源',
			newTab: '（在新标签页中打开）',
			contact: '联系 Inpartner 团队',
			contactPrompt: '需要更具体的回答？请联系 Inpartner 团队',
			errorLabel: '错误：',
			retry: '重试',
			disclaimer: 'AI 可能会出错，请核实重要信息。',
			tooLong: '问题太长了，请控制在 {max} 个字符以内。',
			empty: '请先输入问题。',
			errNetwork: '无法连接到助手，请检查网络连接后重试。',
			errTimeout: '助手响应时间过长，请重试。',
			errRate: '您发送消息的速度过快，请稍等片刻后再试。',
			errGeneric: '助手暂时无法使用。请稍后再试，或直接与我们联系。',
			counter: '{n} / {max} 字',
			clear: '清除对话',
			requestConsult: '申请咨询',
			leadName: '姓名',
			leadEmail: '电子邮箱',
			leadCompany: '公司名称（选填）',
			leadMessage: '咨询内容',
			leadSubmit: '提交申请',
			leadCancel: '取消',
			leadSuccess: '谢谢！您的咨询请求已发送给 Inpartner 团队。',
			leadError: '请填写有效的姓名和电子邮箱地址。',
			leadFailed: '无法发送您的请求。请稍后再试，或使用联系链接。',
			leadPrivacy: '您填写的信息仅会提供给 Inpartner 团队，用于回复本次咨询。',
			online: '在线',
			launcherBadge: '与 Inpartner 聊天',
			quickTitle: '有什么可以帮您？',
			quickActions: '快捷操作',
			quickQuestions: '常见问题',
			editQuestion: '编辑问题',
			edit: '编辑',
			viewDetails: '查看服务详情'
		}
	};

	/** Switcher labels: short visible code plus the language's own name for screen readers. */
	var LANGUAGE_LABELS = {
		en: { short: 'EN', name: 'English' },
		id: { short: 'ID', name: 'Bahasa Indonesia' },
		ko: { short: '한국어', name: '' },
		ja: { short: '日本語', name: '' },
		zh: { short: '简体中文', name: '' }
	};

	/** The visitor's question shows they want to engage the team (consult, meet, get a price). */
	var CONSULT_INTENT_RE = /\b(consult|consultation|consultations|schedule (a )?(call|meeting)|book (a )?(call|meeting|consultation)|talk to (your|a|an|the) (team|consultant|advisor|expert)s?|contact (you|your team|the team|inpartner)|get in touch|hire (you|inpartner)|work with (you|inpartner)|proposal|quotation|quote|pricing|prices?|costs?|fees?|konsul|konsultasi|berkonsultasi|jadwal|jadwalkan|meeting|ketemu|bertemu|(meng)?hubungi|kerja ?sama|penawaran|biaya(nya)?|harga(nya)?|tarif(nya)?)\b|상담|미팅|견적|비용|相談|打ち合わせ|見積|費用|料金|問い合わせ|咨询|预约|会议|报价|费用|价格|合作/i;

	/** The assistant's answer points the visitor to the team. Narrow on purpose: the self-introduction must not match. */
	var CONSULT_INVITE_RE = /\b(contact|reach out to|get in touch with|speak (with|to)|talk (with|to)|discuss[^.!?]{0,60}with) (our|the) (inpartner )?(team|consultants?|advisors?|experts?)\b|\b(schedule|book) (a )?(call|meeting|consultation)\b|\b(meng)?hubungi (tim|kami)\b|\bdiskusikan[^.!?]{0,60}(dengan|bersama) tim\b|\bjadwalkan\b|문의해 주세요|연락(해|주)|お問い合わせ|ご相談ください|联系我们|联系[^。！？]{0,10}团队|预约/i;

	function format(template, values) {
		return template.replace(/\{(\w+)\}/g, function (_, key) {
			return Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : '';
		});
	}

	/** Returns a normalised https URL if it is on an approved host, otherwise null. */
	function safeUrl(value, allowedHosts) {
		if (typeof value !== 'string' || value.length > 2048) return null;
		var url;
		try {
			url = new URL(value);
		} catch (e) {
			return null;
		}
		if (url.protocol !== 'https:' || url.username || url.password) return null;
		if (allowedHosts.indexOf(url.hostname.toLowerCase()) === -1) return null;
		return url.href;
	}

	/** Returns a safe contact destination (mailto: address or approved https:// URL), otherwise null. */
	function safeContactUrl(value, allowedHosts) {
		if (typeof value !== 'string' || value.length > 2048) return null;
		if (/^mailto:/i.test(value)) {
			var email = value.slice(7).trim();
			if (email.length <= 254 && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email)) {
				return 'mailto:' + email;
			}
			return null;
		}
		return safeUrl(value, allowedHosts);
	}

	function el(tag, attrs, text) {
		var node = document.createElement(tag);
		if (attrs) {
			Object.keys(attrs).forEach(function (key) {
				node.setAttribute(key, attrs[key]);
			});
		}
		if (text !== undefined && text !== null) node.textContent = String(text);
		return node;
	}

	function storage() {
		try {
			return window.sessionStorage;
		} catch (e) {
			return null;
		}
	}

	function readLanguageChoice() {
		try {
			return window.localStorage.getItem(LANG_KEY);
		} catch (e) {
			return null;
		}
	}

	function saveLanguageChoice(code) {
		try {
			window.localStorage.setItem(LANG_KEY, code);
		} catch (e) {
			/* storage blocked: the choice lasts for this page only */
		}
	}

	/** Maps a BCP 47 tag (ko-KR, id, in-ID, en-GB) onto a supported language, or null. */
	function matchLanguage(tag, languages) {
		if (typeof tag !== 'string') return null;
		var primary = tag.toLowerCase().split(/[-_]/)[0];
		if (primary === 'in') primary = 'id'; // legacy code for Indonesian
		return languages.indexOf(primary) !== -1 ? primary : null;
	}

	/** Visitor's earlier choice, then the browser language (when enabled), then the admin default. */
	function resolveLanguage(config, languages, fallback) {
		if (config.switcher) {
			var saved = readLanguageChoice();
			if (languages.indexOf(saved) !== -1) return saved;
		}
		if (config.detectBrowser && window.navigator) {
			var tags = window.navigator.languages && window.navigator.languages.length ? window.navigator.languages : [window.navigator.language];
			for (var i = 0; i < tags.length; i++) {
				var match = matchLanguage(tags[i], languages);
				if (match) return match;
			}
		}
		return fallback;
	}

	function createWidget(config) {
		var defaultLang = STRINGS[config.language] ? config.language : 'en';
		var languages = (Array.isArray(config.languages) ? config.languages : []).filter(function (code, i, all) {
			return Object.prototype.hasOwnProperty.call(STRINGS, code) && all.indexOf(code) === i;
		});
		if (languages.indexOf(defaultLang) === -1) languages.unshift(defaultLang);
		var lang = resolveLanguage(config, languages, defaultLang);
		var t = STRINGS[lang];
		var maxLength = Number(config.maxLength) > 0 ? Number(config.maxLength) : 500;
		var sourceHosts = Array.isArray(config.sourceHosts) ? config.sourceHosts : [];
		var contactHosts = Array.isArray(config.contactHosts) ? config.contactHosts : [];
		var contactUrl = safeContactUrl(config.contactUrl, contactHosts);
		var history = [];
		var pending = false;
		var lastQuestion = '';
		var clientCache = {};

		/* ---------- DOM ---------- */
		var root = el('div', { id: 'wkc-root', class: 'wkc', lang: lang });

		var launcherWrap = el('div', { class: 'wkc-launcher-wrap' });
		var launcherBadge = el('button', {
			type: 'button',
			class: 'wkc-launcher-badge',
			'aria-hidden': 'true',
			tabindex: '-1'
		}, t.launcherBadge || 'Chat dengan Inpartner');
		launcherBadge.addEventListener('click', function () {
			launcher.click();
		});

		var launcher = el('button', {
			type: 'button',
			class: 'wkc-launcher',
			'aria-expanded': 'false',
			'aria-controls': 'wkc-panel',
			'aria-label': t.open
		});
		launcher.appendChild(chatIcon());
		launcherWrap.appendChild(launcherBadge);
		launcherWrap.appendChild(launcher);

		var panel = el('section', { id: 'wkc-panel', class: 'wkc-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'wkc-title', 'aria-describedby': 'wkc-subtitle' });
		panel.hidden = true;

		var header = el('div', { class: 'wkc-header' });
		var clearBtn = el('button', { type: 'button', class: 'wkc-clear', 'aria-label': t.clear, title: t.clear });
		clearBtn.appendChild(el('span', { 'aria-hidden': 'true' }, '←'));
		clearBtn.addEventListener('click', function () {
			history = [];
			persist();
			while (log.firstChild) log.removeChild(log.firstChild);
			renderGreeting();
			renderSuggestions();
			input.value = '';
			updateCounter();
			updateSendIcon();
			formError.textContent = '';
			input.focus();
		});

		var brand = el('div', { class: 'wkc-brand' });
		var headings = el('div', { class: 'wkc-headings' });
		var title = el('h2', { id: 'wkc-title', class: 'wkc-title' }, t.title);
		var subtitle = el('p', { id: 'wkc-subtitle', class: 'wkc-subtitle wkc-sr-only' }, t.subtitle || '');
		headings.appendChild(title);
		headings.appendChild(subtitle);
		brand.appendChild(headings);

		var closeBtn = el('button', { type: 'button', class: 'wkc-close', 'aria-label': t.close });
		closeBtn.appendChild(el('span', { 'aria-hidden': 'true' }, '×'));

		var switcherWrap = null;
		var switcher = null;
		var toggleBtn = null;
		var toggleCur = null;
		if (config.switcher && languages.length > 1) {
			switcherWrap = el('div', { class: 'wkc-switcher-wrap' });
			toggleBtn = el('button', {
				type: 'button',
				class: 'wkc-lang-toggle',
				'aria-haspopup': 'true',
				'aria-expanded': 'false',
				'aria-controls': 'wkc-langs',
				// Accessible name must contain the visible code (WCAG 2.5.3 Label in Name).
				'aria-label': t.language + ' ' + lang.toUpperCase(),
				title: t.language
			});
			toggleBtn.appendChild(globeIcon());
			toggleCur = el('span', { class: 'wkc-lang-cur' }, lang === 'ko' ? 'KO' : lang.toUpperCase());
			toggleBtn.appendChild(toggleCur);
			var chevron = el('span', { class: 'wkc-lang-chevron', 'aria-hidden': 'true' }, '▾');
			toggleBtn.appendChild(chevron);

			switcher = el('div', { id: 'wkc-langs', class: 'wkc-langs', role: 'group', 'aria-label': t.language });
			languages.forEach(function (code) {
				var labels = LANGUAGE_LABELS[code] || { short: code.toUpperCase(), name: '' };
				var btn = el('button', { type: 'button', class: 'wkc-lang', lang: code, 'data-lang': code, 'aria-pressed': 'false', title: labels.name || labels.short }, labels.short);
				if (labels.name) btn.appendChild(el('span', { class: 'wkc-lang-name' }, ' ' + labels.name));
				btn.addEventListener('click', function () {
					if (code !== lang) {
						saveLanguageChoice(code);
						applyLanguage(code);
					}
					closeDropdown();
				});
				switcher.appendChild(btn);
			});

			function openDropdown() {
				switcherWrap.classList.add('wkc--open');
				toggleBtn.setAttribute('aria-expanded', 'true');
			}

			function closeDropdown() {
				if (switcherWrap) {
					switcherWrap.classList.remove('wkc--open');
					toggleBtn.setAttribute('aria-expanded', 'false');
				}
			}

			toggleBtn.addEventListener('click', function (e) {
				e.stopPropagation();
				if (switcherWrap.classList.contains('wkc--open')) {
					closeDropdown();
				} else {
					openDropdown();
				}
			});

			document.addEventListener('click', function (e) {
				if (switcherWrap && !switcherWrap.contains(e.target)) {
					closeDropdown();
				}
			});

			switcherWrap.appendChild(toggleBtn);
			switcherWrap.appendChild(switcher);
		}

		header.appendChild(clearBtn);
		header.appendChild(brand);
		if (switcherWrap) header.appendChild(switcherWrap);
		header.appendChild(closeBtn);

		var log = el('div', { class: 'wkc-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': t.title, tabindex: '0' });
		var status = el('div', { class: 'wkc-sr-only', role: 'status', 'aria-live': 'polite' });

		var suggestions = el('div', { id: 'wkc-suggestions', class: 'wkc-suggestions', role: 'group', 'aria-label': t.suggestions });
		suggestions.hidden = true;

		var form = el('form', { class: 'wkc-form', novalidate: 'novalidate' });
		var label = el('label', { for: 'wkc-input', class: 'wkc-sr-only' }, t.inputLabel);
		var input = el('textarea', { id: 'wkc-input', class: 'wkc-input', rows: '1', maxlength: String(maxLength), placeholder: t.placeholder, 'aria-describedby': 'wkc-counter wkc-form-error', autocomplete: 'off' });
		var sendBtn = el('button', { type: 'submit', class: 'wkc-send' });
		sendBtn.appendChild(sendIcon());
		var sendLabel = el('span', { class: 'wkc-send-label' }, t.send);
		sendBtn.appendChild(sendLabel);
		var meta = el('div', { class: 'wkc-form-meta' });
		var formError = el('p', { id: 'wkc-form-error', class: 'wkc-form-error', role: 'alert' });
		var counter = el('p', { id: 'wkc-counter', class: 'wkc-counter' }, format(t.counter, { n: 0, max: maxLength }));
		meta.appendChild(formError);
		meta.appendChild(counter);
		form.appendChild(label);
		var row = el('div', { class: 'wkc-input-row' });
		var plusBtn = el('button', {
			type: 'button',
			class: 'wkc-input-plus',
			'aria-label': t.quickActions,
			'aria-expanded': 'false',
			'aria-controls': 'wkc-suggestions',
			title: t.quickQuestions
		}, '+');
		plusBtn.addEventListener('click', function () {
			suggestions.hidden = !suggestions.hidden;
			var isOpen = !suggestions.hidden;
			plusBtn.classList.toggle('wkc-plus--open', isOpen);
			plusBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
			if (isOpen) {
				setTimeout(function () {
					log.scrollTop = log.scrollHeight;
				}, 40);
			}
		});
		row.appendChild(plusBtn);
		row.appendChild(input);
		row.appendChild(sendBtn);
		form.appendChild(row);
		form.appendChild(meta);

		var footer = el('div', { class: 'wkc-footer' });

		panel.appendChild(header);
		panel.appendChild(log);
		panel.appendChild(suggestions);
		panel.appendChild(status);
		panel.appendChild(form);
		panel.appendChild(footer);
		root.appendChild(panel);
		root.appendChild(launcherWrap);
		document.body.appendChild(root);

		/* ---------- Rendering ---------- */
		function sparkleIcon() {
			var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 24 24');
			svg.setAttribute('aria-hidden', 'true');
			svg.setAttribute('focusable', 'false');
			var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('fill', 'currentColor');
			path.setAttribute('d', 'M10 2c0 4.418-3.582 8-8 8 4.418 0 8 3.582 8 8 0-4.418 3.582-8 8-8-4.418 0-8-3.582-8-8zm9 10c0 1.657-1.343 3-3 3 1.657 0 3 1.343 3 3 0-1.657 1.343-3 3-3-1.657 0-3-1.343-3-3z');
			svg.appendChild(path);
			return svg;
		}

		function editIcon() {
			var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 24 24');
			svg.setAttribute('aria-hidden', 'true');
			svg.setAttribute('focusable', 'false');
			var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('fill', 'currentColor');
			path.setAttribute('d', 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z');
			svg.appendChild(path);
			return svg;
		}

		function chatIcon() {
			return sparkleIcon();
		}

		function globeIcon() {
			var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 24 24');
			svg.setAttribute('width', '14');
			svg.setAttribute('height', '14');
			svg.setAttribute('fill', 'none');
			svg.setAttribute('stroke', 'currentColor');
			svg.setAttribute('stroke-width', '2');
			svg.setAttribute('stroke-linecap', 'round');
			svg.setAttribute('stroke-linejoin', 'round');
			svg.setAttribute('aria-hidden', 'true');
			svg.setAttribute('focusable', 'false');
			var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
			circle.setAttribute('cx', '12');
			circle.setAttribute('cy', '12');
			circle.setAttribute('r', '10');
			svg.appendChild(circle);
			var path1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			path1.setAttribute('x1', '2');
			path1.setAttribute('y1', '12');
			path1.setAttribute('x2', '22');
			path1.setAttribute('y2', '12');
			svg.appendChild(path1);
			var path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path2.setAttribute('d', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z');
			svg.appendChild(path2);
			return svg;
		}

		function sendIcon() {
			var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('viewBox', '0 0 24 24');
			svg.setAttribute('width', '18');
			svg.setAttribute('height', '18');
			svg.setAttribute('aria-hidden', 'true');
			svg.setAttribute('focusable', 'false');
			var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('fill', 'currentColor');
			path.setAttribute('d', 'M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.993.993 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.98L17 12 2.87 13.9c-.5.05-.87.48-.87.98l.01 4.51c0 .71.73 1.2 1.39.91z');
			svg.appendChild(path);
			return svg;
		}

		function externalLink(href, text, className, labelKey) {
			var a = el('a', { href: href, target: '_blank', rel: 'noopener noreferrer', class: className || '' });
			if (labelKey) a.setAttribute('data-label-key', labelKey);
			a.appendChild(el('span', { class: 'wkc-link-label' }, text));
			a.appendChild(el('span', { class: 'wkc-sr-only wkc-new-tab' }, ' ' + t.newTab));
			return a;
		}

		var leadFormCount = 0;
		var LEAD_LIMITS = { name: 100, email: 254, company: 150, message: 2000 };

		function renderLeadForm(parentItem, prefill) {
			if (parentItem.querySelector('.wkc-lead-card')) return;
			var uid = 'wkc-lead-' + ++leadFormCount;
			var card = el('form', { class: 'wkc-lead-card', 'aria-labelledby': uid + '-title', novalidate: 'novalidate' });
			card.appendChild(el('p', { class: 'wkc-lead-title', id: uid + '-title' }, t.requestConsult));

			function field(name, tag, attrs, labelKey) {
				var labelText = t[labelKey];
				var id = uid + '-' + name;
				var wrap = el('div', { class: 'wkc-lead-field' });
				wrap.appendChild(el('label', { class: 'wkc-sr-only', for: id, 'data-label-key': labelKey }, labelText));
				attrs.id = id;
				attrs.name = name;
				attrs.placeholder = labelText;
				attrs['data-placeholder-key'] = labelKey;
				attrs.maxlength = String(LEAD_LIMITS[name]);
				var control = el(tag, attrs);
				wrap.appendChild(control);
				card.appendChild(wrap);
				return control;
			}

			var nameInput = field('name', 'input', { type: 'text', class: 'wkc-lead-input', autocomplete: 'name', required: 'required' }, 'leadName');
			var emailInput = field('email', 'input', { type: 'email', class: 'wkc-lead-input', autocomplete: 'email', required: 'required' }, 'leadEmail');
			var compInput = field('company', 'input', { type: 'text', class: 'wkc-lead-input', autocomplete: 'organization' }, 'leadCompany');
			var msgInput = field('message', 'textarea', { class: 'wkc-lead-textarea', rows: '2' }, 'leadMessage');
			if (prefill) msgInput.value = String(prefill).slice(0, LEAD_LIMITS.message);

			// Honeypot: invisible to people and assistive technology, filled in by naive bots.
			var trap = el('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', class: 'wkc-lead-hp' });
			card.appendChild(trap);

			card.appendChild(el('p', { class: 'wkc-lead-privacy' }, t.leadPrivacy));
			var leadErr = el('div', { class: 'wkc-lead-error', role: 'alert', 'aria-live': 'assertive' });
			card.appendChild(leadErr);

			var btnRow = el('div', { class: 'wkc-lead-actions' });
			var submitBtn = el('button', { type: 'submit', class: 'wkc-lead-submit' }, t.leadSubmit);
			var cancelBtn = el('button', { type: 'button', class: 'wkc-lead-cancel' }, t.leadCancel);

			cancelBtn.addEventListener('click', function () {
				card.remove();
				input.focus();
			});

			card.addEventListener('submit', function (e) {
				e.preventDefault();
				var nameVal = nameInput.value.trim();
				var emailVal = emailInput.value.trim();
				if (!nameVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
					leadErr.textContent = t.leadError;
					(nameVal ? emailInput : nameInput).focus();
					return;
				}
				submitBtn.disabled = true;
				cancelBtn.disabled = true;
				leadErr.textContent = '';

				var leadEndpoint = (config.restUrl || '').replace(/\/chat$/, '/lead');
				fetch(leadEndpoint, {
					method: 'POST',
					credentials: 'omit',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({
						name: nameVal,
						email: emailVal,
						company: compInput.value.trim(),
						message: msgInput.value.trim(),
						language: lang,
						website: trap.value
					})
				})
					.then(function (res) {
						return res
							.json()
							.catch(function () {
								return null;
							})
							.then(function (data) {
								return { ok: res.ok, status: res.status, data: data };
							});
					})
					.then(function (result) {
						if (result.ok && result.data && result.data.success === true) {
							card.remove();
							// A notice, not part of the conversation: it is neither stored nor sent to the assistant as context.
							renderMessage({ role: 'bot', text: t.leadSuccess, grounded: true, isGreeting: true });
							status.textContent = t.leadSuccess;
							input.focus();
							return;
						}
						// Keep what the visitor typed so they can correct it or try again.
						submitBtn.disabled = false;
						cancelBtn.disabled = false;
						leadErr.textContent = result.status === 400 ? t.leadError : result.status === 429 ? t.errRate : t.leadFailed;
					})
					.catch(function () {
						submitBtn.disabled = false;
						cancelBtn.disabled = false;
						leadErr.textContent = t.errNetwork;
					});
			});

			btnRow.appendChild(submitBtn);
			btnRow.appendChild(cancelBtn);
			card.appendChild(btnRow);
			parentItem.appendChild(card);
			nameInput.focus();
		}

		function renderMessage(msg) {
			var item = el('div', { class: 'wkc-msg wkc-msg--' + msg.role });
			item.appendChild(el('span', { class: 'wkc-sr-only wkc-msg-speaker', 'data-role': msg.role }, msg.role === 'user' ? t.you : t.assistant));
			var bubble = el('div', { class: 'wkc-bubble' });
			if (msg.role === 'user') {
				var wrap = el('div', { class: 'wkc-user-wrap' });
				var editBtn = el('button', { type: 'button', class: 'wkc-user-action', 'aria-label': t.editQuestion, title: t.edit });
				editBtn.appendChild(editIcon());
				editBtn.addEventListener('click', function () {
					input.value = msg.text;
					input.focus();
					updateCounter();
					updateSendIcon();
				});
				wrap.appendChild(editBtn);
				wrap.appendChild(bubble);
				item.appendChild(wrap);
			} else {
				var botAvatar = el('div', { class: 'wkc-bot-avatar', 'aria-hidden': 'true' });
				botAvatar.appendChild(sparkleIcon());
				item.appendChild(botAvatar);
				item.appendChild(bubble);
			}
			String(msg.text).split(/\n{2,}/).forEach(function (para) {
				var lines = para.split(/\n/);
				var hasBullets = lines.some(function (l) { return /^[-*•✓]\s+/.test(l.trim()); });
				if (hasBullets) {
					var ul = el('ul', { class: 'wkc-bullet-list' });
					lines.forEach(function (line) {
						var trimmed = line.trim();
						if (/^[-*•✓]\s+/.test(trimmed)) {
							ul.appendChild(el('li', null, trimmed.replace(/^[-*•✓]\s+/, '')));
						} else if (trimmed) {
							ul.appendChild(el('li', null, trimmed));
						}
					});
					bubble.appendChild(ul);
				} else {
					var p = el('p');
					lines.forEach(function (line, idx) {
						if (idx > 0) p.appendChild(document.createElement('br'));
						p.appendChild(document.createTextNode(line));
					});
					bubble.appendChild(p);
				}
			});

			if (msg.role === 'bot') {
				if ((!msg.grounded || msg.consult) && !msg.isGreeting) {
					var botActions = el('div', { class: 'wkc-bot-actions' });
					var consultBtn = el('button', { type: 'button', class: 'wkc-lead-btn' }, t.requestConsult);
					consultBtn.addEventListener('click', function () {
						renderLeadForm(item);
					});
					botActions.appendChild(consultBtn);
					if (contactUrl) {
						var cta = el('p', { class: 'wkc-cta' });
						cta.appendChild(externalLink(contactUrl, t.contactPrompt, '', 'contactPrompt'));
						botActions.appendChild(cta);
					}
					item.appendChild(botActions);
				}
			}
			log.appendChild(item);
			log.scrollTop = log.scrollHeight;
			setTimeout(function () {
				log.scrollTop = log.scrollHeight;
			}, 60);
			return item;
		}

		function renderError(text, retryable, errorKey) {
			var item = el('div', { class: 'wkc-msg wkc-msg--error' });
			var bubble = el('div', { class: 'wkc-bubble' });
			var p = el('p');
			p.appendChild(el('strong', { class: 'wkc-error-label' }, '⚠ ' + t.errorLabel + ' '));
			var textNode = el('span', { class: 'wkc-error-text' }, text);
			if (errorKey) textNode.setAttribute('data-error-key', errorKey);
			p.appendChild(textNode);
			bubble.appendChild(p);
			if (retryable && lastQuestion) {
				var retry = el('button', { type: 'button', class: 'wkc-retry' }, t.retry);
				retry.addEventListener('click', function () {
					item.remove();
					send(lastQuestion);
				});
				bubble.appendChild(retry);
			}
			if (contactUrl) {
				var cta = el('p', { class: 'wkc-cta' });
				cta.appendChild(externalLink(contactUrl, t.contact, '', 'contact'));
				bubble.appendChild(cta);
			}
			item.appendChild(bubble);
			log.appendChild(item);
			log.scrollTop = log.scrollHeight;
		}

		function greetingFor(code) {
			if (config.greetings && typeof config.greetings[code] === 'string') return config.greetings[code];
			return typeof config.greeting === 'string' ? config.greeting : '';
		}

		function suggestionsFor(code) {
			if (Array.isArray(config.suggestions)) return config.suggestions;
			return config.suggestions && Array.isArray(config.suggestions[code]) ? config.suggestions[code] : [];
		}

		var greetingItem = null;
		function renderGreeting() {
			if (greetingItem) greetingItem.remove();
			greetingItem = null;
			var text = greetingFor(lang);
			if (!text) return;
			greetingItem = renderMessage({ role: 'bot', text: text, grounded: true, isGreeting: true });
			log.insertBefore(greetingItem, log.firstChild);
		}

		function renderSuggestions() {
			while (suggestions.firstChild) suggestions.removeChild(suggestions.firstChild);
			var list = suggestionsFor(lang).slice(0, 4);
			if (list.length) {
				suggestions.appendChild(el('p', { class: 'wkc-suggestions-title' }, t.quickTitle || 'Apa yang ingin Anda lakukan?'));
			}
			list.forEach(function (q) {
				if (typeof q !== 'string' || !q) return;
				var chip = el('button', { type: 'button', class: 'wkc-chip' }, q);
				chip.disabled = pending;
				chip.addEventListener('click', function () {
					submit(q);
				});
				suggestions.appendChild(chip);
			});
		}

		function renderFooter() {
			while (footer.firstChild) footer.removeChild(footer.firstChild);
			if (contactUrl) footer.appendChild(externalLink(contactUrl, t.contact, 'wkc-contact', 'contact'));
			footer.appendChild(el('p', { class: 'wkc-disclaimer' }, t.disclaimer));
		}

		/** Switches every interface string to another language; the conversation is kept. */
		function applyLanguage(code) {
			lang = code;
			t = STRINGS[code];
			root.setAttribute('lang', code);
			title.textContent = t.title;
			if (subtitle) subtitle.textContent = t.subtitle || '';
			launcherBadge.textContent = t.launcherBadge || 'Chat dengan Inpartner';
			closeBtn.setAttribute('aria-label', t.close);
			if (clearBtn) {
				clearBtn.setAttribute('aria-label', t.clear);
				clearBtn.setAttribute('title', t.clear);
			}
			if (plusBtn) {
				plusBtn.setAttribute('aria-label', t.quickActions);
				plusBtn.setAttribute('title', t.quickQuestions);
			}
			launcher.setAttribute('aria-label', panel.hidden ? t.open : t.close);
			log.setAttribute('aria-label', t.title);
			suggestions.setAttribute('aria-label', t.suggestions);
			label.textContent = t.inputLabel;
			input.setAttribute('placeholder', t.placeholder);
			sendLabel.textContent = t.send;
			formError.textContent = '';
			if (switcher) {
				switcher.setAttribute('aria-label', t.language);
				Array.prototype.forEach.call(switcher.querySelectorAll('button'), function (b) {
					b.setAttribute('aria-pressed', b.getAttribute('data-lang') === code ? 'true' : 'false');
				});
			}
			if (toggleCur) {
				toggleCur.textContent = code === 'ko' ? 'KO' : code.toUpperCase();
			}
			if (toggleBtn) {
				toggleBtn.setAttribute('aria-label', t.language + ' ' + code.toUpperCase());
				toggleBtn.setAttribute('title', t.language);
			}
			Array.prototype.forEach.call(log.querySelectorAll('.wkc-msg-speaker'), function (s) {
				s.textContent = s.getAttribute('data-role') === 'user' ? t.you : t.assistant;
			});
			Array.prototype.forEach.call(log.querySelectorAll('.wkc-user-action'), function (b) {
				b.setAttribute('aria-label', t.editQuestion);
				b.setAttribute('title', t.edit);
			});
			Array.prototype.forEach.call(log.querySelectorAll('.wkc-lead-btn'), function (b) {
				b.textContent = t.requestConsult;
			});
			Array.prototype.forEach.call(log.querySelectorAll('.wkc-retry'), function (b) {
				b.textContent = t.retry;
			});
			Array.prototype.forEach.call(log.querySelectorAll('.wkc-error-label'), function (elLabel) {
				elLabel.textContent = '⚠ ' + t.errorLabel + ' ';
			});
			Array.prototype.forEach.call(log.querySelectorAll('.wkc-error-text[data-error-key]'), function (elErr) {
				var k = elErr.getAttribute('data-error-key');
				if (k && t[k]) elErr.textContent = t[k];
			});
			Array.prototype.forEach.call(log.querySelectorAll('a[data-label-key]'), function (a) {
				var k = a.getAttribute('data-label-key');
				var lbl = a.querySelector('.wkc-link-label');
				var nt = a.querySelector('.wkc-new-tab');
				if (lbl && k && t[k]) lbl.textContent = t[k];
				if (nt) nt.textContent = ' ' + t.newTab;
			});
			Array.prototype.forEach.call(log.querySelectorAll('.wkc-lead-card'), function (card) {
				var cardTitle = card.querySelector('.wkc-lead-title');
				if (cardTitle) cardTitle.textContent = t.requestConsult;
				var cardPriv = card.querySelector('.wkc-lead-privacy');
				if (cardPriv) cardPriv.textContent = t.leadPrivacy;
				var cardSub = card.querySelector('.wkc-lead-submit');
				if (cardSub) cardSub.textContent = t.leadSubmit;
				var cardCan = card.querySelector('.wkc-lead-cancel');
				if (cardCan) cardCan.textContent = t.leadCancel;
				Array.prototype.forEach.call(card.querySelectorAll('label[data-label-key]'), function (l) {
					var k = l.getAttribute('data-label-key');
					if (k && t[k]) l.textContent = t[k];
				});
				Array.prototype.forEach.call(card.querySelectorAll('[data-placeholder-key]'), function (inp) {
					var k = inp.getAttribute('data-placeholder-key');
					if (k && t[k]) inp.setAttribute('placeholder', t[k]);
				});
			});
			updateCounter();
			renderFooter();
			renderSuggestions();
			renderGreeting();
		}

		function renderTyping() {
			var item = el('div', { class: 'wkc-msg wkc-msg--bot wkc-typing', 'aria-hidden': 'true' });
			var bubble = el('div', { class: 'wkc-bubble' });
			for (var i = 0; i < 3; i++) bubble.appendChild(el('span', { class: 'wkc-dot' }));
			item.appendChild(bubble);
			log.appendChild(item);
			log.scrollTop = log.scrollHeight;
			setTimeout(function () {
				log.scrollTop = log.scrollHeight;
			}, 60);
			return item;
		}

		/* ---------- State ---------- */
		function persist() {
			var store = storage();
			if (!store) return;
			try {
				store.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
			} catch (e) {
				/* storage full or blocked: history simply is not kept */
			}
		}

		function restore() {
			var store = storage();
			if (!store) return [];
			try {
				var parsed = JSON.parse(store.getItem(STORAGE_KEY) || '[]');
				return Array.isArray(parsed)
					? parsed.filter(function (m) {
							return m && (m.role === 'user' || m.role === 'bot') && typeof m.text === 'string';
						}).slice(-MAX_HISTORY)
					: [];
			} catch (e) {
				return [];
			}
		}

		function addMessage(msg) {
			history.push(msg);
			persist();
			return renderMessage(msg);
		}

		var leadAutoOpened = false;

		/** Adds an answer, offering the lead form when the conversation turns to a consultation. */
		function addBotAnswer(question, answer, sources, grounded) {
			var wantsConsult = CONSULT_INTENT_RE.test(question);
			var msg = { role: 'bot', text: answer, sources: sources, grounded: grounded };
			if (wantsConsult || CONSULT_INVITE_RE.test(answer)) msg.consult = true;
			var item = addMessage(msg);
			// Open the form once per page load, so a cancelled or sent form does not keep popping up.
			if (wantsConsult && !leadAutoOpened) {
				leadAutoOpened = true;
				renderLeadForm(item, question);
				log.scrollTop = log.scrollHeight;
			}
		}

		function setPending(value) {
			pending = value;
			sendBtn.disabled = value;
			input.setAttribute('aria-disabled', value ? 'true' : 'false');
			log.setAttribute('aria-busy', value ? 'true' : 'false');
			Array.prototype.forEach.call(suggestions.querySelectorAll('button'), function (b) {
				b.disabled = value;
			});
		}

		function updateCounter() {
			var n = input.value.length;
			// Grow with the content up to the CSS max-height, then scroll.
			input.style.height = 'auto';
			if (input.scrollHeight > input.clientHeight) input.style.height = Math.min(input.scrollHeight + 2, 120) + 'px';
			counter.textContent = format(t.counter, { n: n, max: maxLength });
			counter.classList.toggle('wkc-counter--near', n > maxLength * 0.9);
		}

		function updateSendIcon() {
			var hasText = input.value.trim().length > 0;
			sendBtn.classList.toggle('wkc-send--ready', hasText);
		}

		/* ---------- Networking ---------- */
		function errorMessageFor(status) {
			if (status === 429) return t.errRate;
			return t.errGeneric;
		}

		function send(question) {
			if (pending) return;
			lastQuestion = question;
			setPending(true);
			status.textContent = t.typing;
			var typing = renderTyping();

			var controller = typeof AbortController === 'function' ? new AbortController() : null;
			var timer = setTimeout(function () {
				if (controller) controller.abort();
			}, REQUEST_TIMEOUT_MS);
			var stepTimer1 = setTimeout(function () {
				if (pending && status && typeof t.analyzing === 'string') {
					status.textContent = t.analyzing;
				}
			}, 1500);
			var stepTimer2 = setTimeout(function () {
				if (pending && status && typeof t.formulating === 'string') {
					status.textContent = t.formulating;
				}
			}, 3500);

			var payload = { message: question, language: lang };
			var prevHistory = history.slice(0, -1);
			var recentHistory = prevHistory
				.filter(function (m) {
					return m && !m.isGreeting && (m.role === 'user' || m.role === 'bot') && typeof m.text === 'string';
				})
				.slice(-4)
				.map(function (m) {
					return { role: m.role === 'bot' ? 'model' : 'user', text: m.text.slice(0, m.role === 'bot' ? 1500 : 500) };
				});
			if (recentHistory.length > 0) {
				payload.history = recentHistory;
			}

			fetch(config.restUrl, {
				method: 'POST',
				credentials: 'omit',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify(payload),
				signal: controller ? controller.signal : undefined
			})
				.then(function (res) {
					return res
						.json()
						.catch(function () {
							return null;
						})
						.then(function (data) {
							return { ok: res.ok, status: res.status, data: data };
						});
				})
				.then(function (result) {
					typing.remove();
					var d = result.data;
					if (result.ok && d && typeof d.answer === 'string') {
						addBotAnswer(question, d.answer, Array.isArray(d.sources) ? d.sources : [], d.grounded === true);
						status.textContent = t.received;
						if (d.grounded === true && (!payload.history || payload.history.length === 0)) {
							clientCache[lang + ':' + question.toLowerCase()] = {
								answer: d.answer,
								sources: Array.isArray(d.sources) ? d.sources : []
							};
						}
					} else {
						var serverMsg = d && typeof d.message === 'string' && result.status >= 400 && result.status < 500 && result.status !== 403 ? d.message : null;
						var errKey = serverMsg ? null : (result.status === 429 ? 'errRate' : 'errGeneric');
						renderError(serverMsg || errorMessageFor(result.status), result.status !== 400, errKey);
						status.textContent = t.errorLabel + ' ' + (serverMsg || errorMessageFor(result.status));
					}
				})
				.catch(function (err) {
					typing.remove();
					var isTimeout = err && err.name === 'AbortError';
					var msg = isTimeout ? t.errTimeout : t.errNetwork;
					renderError(msg, true, isTimeout ? 'errTimeout' : 'errNetwork');
					status.textContent = t.errorLabel + ' ' + msg;
				})
				.then(function () {
					clearTimeout(timer);
					clearTimeout(stepTimer1);
					clearTimeout(stepTimer2);
					setPending(false);
				});
		}

		function submit(raw) {
			if (pending) return;
			var question = String(raw || '').replace(/\s+/g, ' ').trim();
			formError.textContent = '';
			if (!question) {
				formError.textContent = t.empty;
				input.focus();
				return;
			}
			if (question.length > maxLength) {
				formError.textContent = format(t.tooLong, { max: maxLength });
				input.focus();
				return;
			}
			suggestions.hidden = true;
			if (plusBtn) {
				plusBtn.classList.remove('wkc-plus--open');
				plusBtn.setAttribute('aria-expanded', 'false');
			}
			input.value = '';
			updateCounter();
			updateSendIcon();

			var prevTurns = history.filter(function (m) {
				return m && !m.isGreeting && (m.role === 'user' || m.role === 'bot') && typeof m.text === 'string';
			});
			var cacheKey = lang + ':' + question.toLowerCase();

			addMessage({ role: 'user', text: question });

			if (prevTurns.length === 0 && clientCache[cacheKey]) {
				var cached = clientCache[cacheKey];
				addBotAnswer(question, cached.answer, cached.sources || [], true);
				status.textContent = t.received;
				return;
			}

			send(question);
		}

		/* ---------- Open / close ---------- */
		function open() {
			panel.hidden = false;
			root.classList.add('wkc--open');
			launcher.setAttribute('aria-expanded', 'true');
			launcher.setAttribute('aria-label', t.close);
			log.scrollTop = log.scrollHeight;
			input.focus();
		}

		function close() {
			panel.hidden = true;
			root.classList.remove('wkc--open');
			launcher.setAttribute('aria-expanded', 'false');
			launcher.setAttribute('aria-label', t.open);
			launcher.focus();
		}

		launcher.addEventListener('click', function () {
			if (panel.hidden) open();
			else close();
		});
		closeBtn.addEventListener('click', close);
		root.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && !panel.hidden) {
				e.stopPropagation();
				close();
			}
		});
		form.addEventListener('submit', function (e) {
			e.preventDefault();
			submit(input.value);
		});
		input.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
				e.preventDefault();
				submit(input.value);
			}
		});
		input.addEventListener('input', function () {
			formError.textContent = '';
			updateCounter();
			updateSendIcon();
		});

		/* ---------- Initial state ---------- */
		applyLanguage(lang);
		updateSendIcon();
		var restored = restore();
		if (restored.length) {
			history = restored;
			suggestions.hidden = true;
			if (plusBtn) {
				plusBtn.classList.remove('wkc-plus--open');
				plusBtn.setAttribute('aria-expanded', 'false');
			}
			restored.forEach(renderMessage);
		}

		return {
			root: root,
			open: open,
			close: close,
			submit: submit,
			setLanguage: function (code) {
				if (languages.indexOf(code) !== -1) applyLanguage(code);
			},
			getLanguage: function () {
				return lang;
			}
		};
	}

	function init() {
		var config = window.wpKnowledgeChatConfig;
		if (!config || typeof config.restUrl !== 'string' || document.getElementById('wkc-root')) return;
		window.wpKnowledgeChat = createWidget(config);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
