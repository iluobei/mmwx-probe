import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";

// 外置探针的 passkey 登录。
//
// 这里**只做登录、不做注册**:注册端点要已登录会话且走 securechan 加密信道,而本探针是
// 独立构建、没有 securechan 客户端。所以流程是「先去主控注册一把 passkey,再回这里用」。
//
// 能用主控那把 passkey 的前提是主控开了 Related Origin Requests
// (env MMWX_WEBAUTHN_RELATED_ORIGINS 里列上本探针域名):此时 rpId 锚定主控域名,
// 浏览器会去拉 https://<主控域名>/.well-known/webauthn 确认本域名被承认。
// 没开的话浏览器会直接拒绝,下面把这种情况说清楚,而不是丢一句"登录失败"。

function isSecure(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== "undefined"
  );
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface BeginPayload {
  session: string;
  options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
}

interface FinishPayload {
  token?: string;
  // 由 worker 在校验成功后注入 —— 探针页自己不知道主控地址(伪装页不能白给)。
  master_origin?: string;
}

export function PasskeyLogin() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 非安全上下文下浏览器根本没有 navigator.credentials,直接不渲染入口。
  if (!isSecure()) return null;

  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      const beginRes = await post("/api/login/passkey/begin", {
        remember_me: true,
      });
      if (!beginRes.ok) {
        setError("主控未开放 passkey 登录");
        return;
      }
      const { session, options } = (await beginRes.json()) as BeginPayload;

      const assertion = await startAuthentication({ optionsJSON: options });

      const finishRes = await post(
        `/api/login/passkey/finish?session=${encodeURIComponent(session)}`,
        assertion,
      );
      if (!finishRes.ok) {
        setError("passkey 校验失败");
        return;
      }
      const payload = (await finishRes.json()) as FinishPayload;
      if (!payload.token) {
        setError("登录未返回凭据");
        return;
      }

      // 探针域名本身没有后台可进,登录的目的就是进主控。token 由主控签发、不绑域名,
      // 用 fragment 传:它不会随请求发给服务器,也不进访问日志与 Referer。
      const target = (payload.master_origin || "").replace(/\/$/, "");
      if (!target) {
        setError("主控地址未配置");
        return;
      }
      window.location.href = `${target}/#mmwx_token=${encodeURIComponent(payload.token)}`;
    } catch (err) {
      // 用户在系统弹窗点取消(NotAllowedError)不算错误,静默收场。
      if (err instanceof Error && err.name === "NotAllowedError") return;
      if (err instanceof Error && err.name === "SecurityError") {
        setError("本域名未被主控承认,请在主控配置 related origins");
        return;
      }
      setError("登录失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="probe-passkey-login">
      <button
        type="button"
        aria-label="使用 passkey 登录"
        title="使用 passkey 登录"
        onClick={login}
        disabled={busy}
      >
        <KeyRound size={18} />
      </button>
      {error && <em className="probe-passkey-error">{error}</em>}
    </span>
  );
}
