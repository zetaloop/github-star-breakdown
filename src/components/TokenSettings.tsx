import { Eye, EyeOff, KeyRound, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  clearGitHubToken,
  fetchGitHubUser,
  fetchRateLimit,
  type GitHubUser,
  getGitHubToken,
  type RateLimitItem,
  setGitHubToken,
} from "@/services/githubApi";
import { IconButton } from "./ui";

export default function TokenSettings({
  onChange,
}: {
  onChange: (hasToken: boolean) => void;
}) {
  const saved = getGitHubToken();
  const [token, setToken] = useState(saved || "");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState<GitHubUser | null>(null);
  const [quota, setQuota] = useState<RateLimitItem | null>(null);
  const id = useId();
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!saved) return;
      setLoading(true);
      setError("");
      try {
        const [user, limit] = await Promise.all([
          fetchGitHubUser(saved, signal),
          fetchRateLimit(signal),
        ]);
        if (signal?.aborted) return;
        setAccount(user);
        setQuota(limit);
      } catch (cause) {
        if (!signal?.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [saved],
  );

  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await fetchGitHubUser(token, request.current?.signal);
      request.current?.signal.throwIfAborted();
      setGitHubToken(token);
      onChange(true);
    } catch (cause) {
      if (!request.current?.signal.aborted) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="token-settings">
      {saved && (
        <section className="quota-section" aria-label="GitHub API 额度">
          <div className="quota-heading">
            <div className="connected-account">
              {account ? (
                <img src={account.avatar_url} alt="" width={28} height={28} />
              ) : (
                <KeyRound size={20} />
              )}
              <span>
                {account?.login || (loading ? "正在连接…" : "GitHub 账号")}
              </span>
            </div>
            <IconButton
              label="刷新额度"
              disabled={loading}
              onClick={() => void refresh(request.current?.signal)}
            >
              <RefreshCw className={loading ? "spinning" : ""} />
            </IconButton>
          </div>
          {quota && (
            <>
              <progress
                aria-label="剩余 API 请求额度"
                max={quota.limit}
                value={quota.limit - quota.used}
              />
              <div className="quota-caption">
                <span>
                  剩余 {(quota.limit - quota.used).toLocaleString()} /{" "}
                  {quota.limit.toLocaleString()} 次
                </span>
                <span>
                  {new Date(quota.reset * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  恢复
                </span>
              </div>
            </>
          )}
        </section>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={saving}>
          <label className="field-label" htmlFor={id}>
            GitHub Token
          </label>
          <div className="password-field">
            <input
              id={id}
              type={visible ? "text" : "password"}
              value={token}
              placeholder="粘贴 GitHub Token"
              autoComplete="off"
              spellCheck={false}
              required
              onChange={(event) => setToken(event.target.value)}
            />
            <IconButton
              label={visible ? "隐藏 Token" : "显示 Token"}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff /> : <Eye />}
            </IconButton>
          </div>
          <a
            className="text-link"
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
          >
            创建 Token ↗
          </a>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            {saved && (
              <button
                type="button"
                className="text-button danger"
                onClick={() => {
                  clearGitHubToken();
                  onChange(false);
                }}
              >
                清除 Token
              </button>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={!token.trim()}
            >
              {saving ? "正在验证…" : saved ? "保存 Token" : "连接 GitHub"}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
