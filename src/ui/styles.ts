export const consoleStyles = `:root{color-scheme:dark;font-family:Inter,"Noto Sans SC",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--kumo-base:#0b1019;--kumo-elevated:#111927;--kumo-recessed:#080c13;--kumo-overlay:#182334;--kumo-line:#263449;--kumo-hairline:#34455d;--kumo-default:#f7f9fc;--kumo-subtle:#a9b6c8;--kumo-muted:#738198;--kumo-brand:#f6821f;--kumo-brand-hover:#ff9b46;--kumo-brand-soft:rgba(246,130,31,.14);--kumo-success:#36d399;--kumo-success-soft:rgba(54,211,153,.12);--kumo-danger:#fb7185;--kumo-danger-soft:rgba(251,113,133,.12);--kumo-info:#60a5fa;--kumo-info-soft:rgba(96,165,250,.12);--shadow:0 20px 48px rgba(0,0,0,.22);--radius-lg:18px;--radius-md:12px;--radius-sm:8px}

html[data-mode="light"]{color-scheme:light;--kumo-base:#f6f7f9;--kumo-elevated:#fff;--kumo-recessed:#edf0f4;--kumo-overlay:#fff;--kumo-line:#d9dee7;--kumo-hairline:#c4cbd7;--kumo-default:#172033;--kumo-subtle:#536176;--kumo-muted:#7b8798;--kumo-brand-soft:rgba(246,130,31,.12);--kumo-success-soft:rgba(5,150,105,.1);--kumo-danger-soft:rgba(225,29,72,.1);--kumo-info-soft:rgba(37,99,235,.1);--shadow:0 18px 42px rgba(28,39,57,.1)}

*{box-sizing:border-box}
html{min-height:100%;background:var(--kumo-base)}
body{min-height:100vh;margin:0;color:var(--kumo-default);background:var(--kumo-base)}
button,input,select,textarea{font:inherit}
button{cursor:pointer}
.app-shell{display:grid;grid-template-columns:244px minmax(0,1fr);min-height:100vh}
.sidebar{position:sticky;top:0;height:100vh;padding:18px 14px;border-right:1px solid var(--kumo-line);background:var(--kumo-recessed)}
.brand{display:flex;align-items:center;gap:11px;padding:8px 8px 22px}
.brand-mark{display:grid;width:38px;height:38px;place-items:center;border-radius:11px;color:#fff;background:linear-gradient(145deg,#ff9b46,#e65c00);box-shadow:0 8px 20px rgba(246,130,31,.24);font-weight:900;letter-spacing:-1px}
.brand-title{font-size:14px;font-weight:800;letter-spacing:.03em}
.brand-subtitle{margin-top:3px;color:var(--kumo-muted);font-size:11px}
.nav-title{padding:16px 9px 7px;color:var(--kumo-muted);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.nav-item{display:flex;align-items:center;gap:10px;width:100%;margin:2px 0;padding:10px;border:0;border-radius:8px;color:var(--kumo-subtle);background:transparent;text-align:left;font-size:13px}
.nav-item:hover,.nav-item.active{color:var(--kumo-default);background:var(--kumo-elevated)}
.nav-dot{width:7px;height:7px;border-radius:999px;background:var(--kumo-muted)}
.nav-item.active .nav-dot{background:var(--kumo-brand);box-shadow:0 0 0 4px var(--kumo-brand-soft)}
.sidebar-footer{position:absolute;right:14px;bottom:18px;left:14px}
.content{min-width:0}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px clamp(16px,3vw,36px);border-bottom:1px solid var(--kumo-line);background:color-mix(in srgb,var(--kumo-base) 88%,transparent);backdrop-filter:blur(18px)}
.topbar-title{font-size:14px;font-weight:750}
.topbar-actions{display:flex;align-items:center;gap:9px}
.main{max-width:1480px;margin:auto;padding:clamp(18px,3vw,34px)}
.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:24px}
.eyebrow{margin:0 0 7px;color:var(--kumo-brand);font-size:11px;font-weight:850;letter-spacing:.14em;text-transform:uppercase}
h1,h2,h3,p{margin-top:0}
h1{margin-bottom:7px;font-size:clamp(25px,4vw,38px);letter-spacing:-.045em}
h2{margin-bottom:4px;font-size:16px;letter-spacing:-.015em}
h3{margin-bottom:9px;font-size:13px}
.muted{color:var(--kumo-subtle)}
.caption{color:var(--kumo-muted);font-size:12px;line-height:1.6}
.grid{display:grid;gap:16px}
.overview-grid{grid-template-columns:minmax(0,1.6fr) minmax(280px,.8fr);align-items:start}
.channel-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:16px}
.mini-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:16px}
.layer-card{border:1px solid var(--kumo-line);border-radius:var(--radius-lg);background:var(--kumo-elevated);box-shadow:var(--shadow)}
.card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 17px;border-bottom:1px solid var(--kumo-line)}
.card-body{padding:17px}
.card-actions{display:flex;gap:8px;flex-wrap:wrap}
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid var(--kumo-line);border-radius:999px;color:var(--kumo-subtle);background:var(--kumo-recessed);font-size:11px;font-weight:750}
.badge-dot{width:7px;height:7px;border-radius:50%;background:var(--kumo-muted)}
.badge.ok{color:var(--kumo-success);border-color:color-mix(in srgb,var(--kumo-success) 34%,var(--kumo-line));background:var(--kumo-success-soft)}
.badge.ok .badge-dot{background:var(--kumo-success)}
.badge.bad{color:var(--kumo-danger);background:var(--kumo-danger-soft)}
.button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:8px 12px;border:1px solid var(--kumo-line);border-radius:var(--radius-sm);color:var(--kumo-default);background:var(--kumo-overlay);font-size:12px;font-weight:780;transition:.16s ease}
.button:hover{border-color:var(--kumo-hairline);transform:translateY(-1px)}
.button.primary{border-color:var(--kumo-brand);color:#fff;background:var(--kumo-brand)}
.button.primary:hover{background:var(--kumo-brand-hover)}
.button.ghost{background:transparent}
.button.danger{color:var(--kumo-danger);background:var(--kumo-danger-soft)}
.button.icon{width:36px;padding:0}
.button.wide{width:100%}
.input,.select,.textarea{width:100%;min-height:38px;padding:9px 10px;border:1px solid var(--kumo-line);border-radius:var(--radius-sm);outline:0;color:var(--kumo-default);background:var(--kumo-recessed);font-size:13px}
.textarea{min-height:82px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55}
.input:focus,.select:focus,.textarea:focus{border-color:var(--kumo-brand);box-shadow:0 0 0 3px var(--kumo-brand-soft)}
.label{display:block;margin-bottom:6px;color:var(--kumo-subtle);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
.form-row{display:flex;gap:8px}
.form-row>*{min-width:0;flex:1}
.stack{display:grid;gap:12px}
.device-list{display:grid;gap:8px;max-height:236px;overflow:auto}
.device{width:100%;padding:11px;border:1px solid var(--kumo-line);border-radius:10px;color:var(--kumo-default);background:var(--kumo-recessed);text-align:left}
.device:hover,.device.selected{border-color:var(--kumo-brand);background:var(--kumo-brand-soft)}
.device-name{display:block;font-size:13px;font-weight:760}
.device-id{display:block;margin-top:4px;overflow:hidden;color:var(--kumo-muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.empty{padding:20px 10px;border:1px dashed var(--kumo-line);border-radius:10px;color:var(--kumo-muted);font-size:12px;text-align:center}
.channel-title{display:flex;align-items:center;gap:9px}
.channel-letter{display:grid;width:30px;height:30px;place-items:center;border-radius:9px;color:var(--kumo-brand);background:var(--kumo-brand-soft);font-size:14px;font-weight:900}
.strength-value{font-size:34px;font-weight:850;letter-spacing:-.06em}
.strength-unit{margin-left:4px;color:var(--kumo-muted);font-size:12px;font-weight:700;letter-spacing:0}
.meter{height:7px;margin:13px 0 17px;overflow:hidden;border-radius:999px;background:var(--kumo-recessed)}
.meter-fill{width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--kumo-brand),#ffc078);transition:width .2s ease}
.button-group{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.info-strip{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid color-mix(in srgb,var(--kumo-info) 28%,var(--kumo-line));border-radius:10px;color:var(--kumo-subtle);background:var(--kumo-info-soft);font-size:12px;line-height:1.6}
.stat{padding:14px;border:1px solid var(--kumo-line);border-radius:12px;background:var(--kumo-recessed)}
.stat-label{display:block;color:var(--kumo-muted);font-size:11px}
.stat-value{display:block;margin-top:7px;overflow:hidden;font-size:17px;font-weight:800;text-overflow:ellipsis;white-space:nowrap}
.tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--kumo-line);border-radius:10px;background:var(--kumo-recessed)}
.tab{flex:1;padding:7px;border:0;border-radius:7px;color:var(--kumo-subtle);background:transparent;font-size:12px;font-weight:760}
.tab.active{color:var(--kumo-default);background:var(--kumo-overlay)}
.panel{display:none}
.panel.active{display:block}
.code{min-height:95px;max-height:250px;margin:0;overflow:auto;padding:12px;border:1px solid var(--kumo-line);border-radius:10px;color:var(--kumo-subtle);background:var(--kumo-recessed);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.6;white-space:pre-wrap}
.login-card{margin-bottom:16px}
.mobile-brand{display:none}
.mobile-only{display:none}
@media(max-width:1040px){.app-shell{grid-template-columns:1fr}
.sidebar{display:none}
.mobile-brand{display:flex;align-items:center;gap:9px}
.mobile-brand .brand-mark{width:30px;height:30px;font-size:12px}
.mobile-only{display:inline-flex}
.overview-grid{grid-template-columns:1fr}
}
@media(max-width:720px){.topbar{padding:13px 14px}
.topbar-title{display:none}
.main{padding:17px 13px 26px}
.hero{align-items:flex-start;flex-direction:column;margin-bottom:18px}
.hero .button{width:100%}
.channel-grid,.mini-grid{grid-template-columns:1fr}
.card-head,.card-body{padding:14px}
.form-row.wrap{flex-direction:column}
.button-group .button{padding-inline:6px}
.layer-card{border-radius:14px}
.strength-value{font-size:30px}
}
@media(max-width:390px){.form-row{flex-wrap:wrap}
.form-row>.button{flex-basis:100%}
.topbar-actions{gap:6px}
.topbar-actions .badge{display:none}
}
`;
