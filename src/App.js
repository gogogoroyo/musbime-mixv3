import React, { useState, useEffect } from 'react';

// --- モックデータと選択肢の設定 ---
const USERS = ['🦐', '🐻', '♨️', '🐕‍🦺', '👾'];
const PARTS = ['Vo', 'Cho', '右Gt', '中Gt', '左Gt', 'Ba', 'Dr', '全体'];

// パートごとの視認性を高めるスタイルマップ（標準Tailwind CSSカラーに統一）
const PART_STYLES = {
  Vo: 'bg-yellow-100 text-yellow-800 border-yellow-300 font-bold',
  Cho: 'bg-purple-100 text-purple-800 border-purple-300 font-semibold',
  右Gt: 'bg-green-100 text-green-800 border-green-300 font-semibold',
  中Gt: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
  左Gt: 'bg-blue-100 text-blue-800 border-blue-300 font-semibold',
  Ba: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold',
  Dr: 'bg-red-100 text-red-800 border-red-300 font-semibold',
  全体: 'bg-gray-100 text-gray-700 border-gray-300 font-semibold',
};

// --- GAS設定 ---
const GAS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbzlC53in6XubGf8CyhvB5yB9a0z5JBAqmRjUYba296MYkcsZWvTD-GawNVwE4BD8GyuHQ/exec';

const INITIAL_DATA = [
  {
    id: 'tab-1',
    title: 'シート1',
    rows: [
      {
        id: 'row-1',
        user: '🦐',
        min: '00',
        sec: '00',
        part: '右Gt',
        text: '',
        rawTime: '0000',
      },
    ],
  },
];

export default function MixRevisionApp() {
  const [tabs, setTabs] = useState(INITIAL_DATA);
  const [activeTabId, setActiveTabId] = useState(INITIAL_DATA[0].id);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // フォーカス中の時間入力行IDと入力中一時データ
  const [editingTimeRowId, setEditingTimeRowId] = useState(null);
  const [editingTimeValue, setEditingTimeValue] = useState('');

  // モーダル管理用のステート
  const [deleteModalTabId, setDeleteModalTabId] = useState(null);

  // タブ並び替えドラッグ＆ドロップ用ステート
  const [draggedTabId, setDraggedTabId] = useState(null);

  // --- Tailwind CSS の動的読み込み (画面崩れ防止) ---
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) ||
    tabs[0] || { id: '', title: '', rows: [] };

  // --- 1. GASからのデータ取得 (GET) ---
  const fetchLatestData = (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    fetch(GAS_WEB_APP_URL)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && data.tabs && data.tabs.length > 0) {
          const formattedTabs = data.tabs.map((tab) => ({
            ...tab,
            rows: (tab.rows || []).map((r) => ({
              ...r,
              rawTime: r.rawTime || `${r.min || '00'}${r.sec || '00'}`,
            })),
          }));
          setTabs(formattedTabs);
          if (isManualRefresh) {
            showToast('シートを更新しました');
          }
        }
      })
      .catch((err) => {
        console.error('データ取得エラー:', err);
        showToast('データの読み込みに失敗しました');
      })
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    fetchLatestData(false);
  }, []);

  // --- 2. GASへのデータ保存 (POST) ---
  const saveToGas = (updatedTabs) => {
    setIsSaving(true);

    const payload = {
      tabs: updatedTabs,
    };

    fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status !== 'success') {
          showToast('保存エラー: ' + data.message);
        }
      })
      .catch((err) => {
        console.error('保存エラー:', err);
        showToast('通信エラー: 保存できませんでした');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const updateTabsWithSave = (newTabs) => {
    setTabs(newTabs);
    saveToGas(newTabs);
  };

  // --- タブ操作 ---
  const handleAddTab = () => {
    const newTab = {
      id: `tab-${Date.now()}`,
      title: `新規楽曲 ${tabs.length + 1}`,
      rows: [],
    };
    const newTabs = [...tabs, newTab];
    updateTabsWithSave(newTabs);
    setActiveTabId(newTab.id);
  };

  const confirmDeleteTab = () => {
    if (!deleteModalTabId) return;
    if (tabs.length <= 1) {
      showToast('最後の1枚は削除できません');
      setDeleteModalTabId(null);
      return;
    }

    const newTabs = tabs.filter((t) => t.id !== deleteModalTabId);
    if (activeTabId === deleteModalTabId) {
      setActiveTabId(newTabs[0].id);
    }
    updateTabsWithSave(newTabs);
    setDeleteModalTabId(null);
  };

  // --- タブ並び替え（ドラッグ＆ドロップ） ---
  const handleDragStart = (e, tabId) => {
    setDraggedTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetTabId) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === targetTabId) return;

    const draggedIndex = tabs.findIndex((t) => t.id === draggedTabId);
    const targetIndex = tabs.findIndex((t) => t.id === targetTabId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newTabs = [...tabs];
    const [removed] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, removed);

    setTabs(newTabs);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    saveToGas(tabs);
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    const newTabs = tabs.map((t) =>
      t.id === activeTabId ? { ...t, title: newTitle } : t
    );
    setTabs(newTabs);
  };

  const handleTitleBlur = () => {
    saveToGas(tabs);
  };

  // --- 行（修正指示）操作 ---
  const handleAddRow = () => {
    const currentRows =
      activeTab && Array.isArray(activeTab.rows) ? activeTab.rows : [];
    const lastRow =
      currentRows.length > 0 ? currentRows[currentRows.length - 1] : null;

    const newRow = {
      id: `row-${Date.now()}`,
      user: lastRow ? lastRow.user : USERS[0],
      min: '00',
      sec: '00',
      part: lastRow ? lastRow.part : PARTS[2],
      text: '',
      rawTime: '0000',
    };

    const newTabs = tabs.map((t) => {
      if (t.id === activeTabId) {
        return { ...t, rows: [...(t.rows || []), newRow] };
      }
      return t;
    });
    updateTabsWithSave(newTabs);
  };

  const handleUpdateRow = (rowId, field, value) => {
    const newTabs = tabs.map((t) => {
      if (t.id === activeTabId) {
        return {
          ...t,
          rows: t.rows.map((r) =>
            r.id === rowId ? { ...r, [field]: value } : r
          ),
        };
      }
      return t;
    });
    setTabs(newTabs);
  };

  // 時間入力フォーカス時（自動で全選択）
  const handleTimeFocus = (e, row) => {
    setEditingTimeRowId(row.id);
    setEditingTimeValue(row.rawTime || `${row.min || '00'}${row.sec || '00'}`);

    setTimeout(() => {
      if (e.target) {
        e.target.select();
      }
    }, 0);
  };

  // 時間入力値の変更ハンドラ
  const handleTimeChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 4);
    setEditingTimeValue(digitsOnly);
  };

  // 時間入力フォーカスアウト（確定時）
  const handleTimeBlur = (rowId) => {
    const digitsOnly = editingTimeValue;
    let min = '00';
    let sec = '00';

    if (digitsOnly.length === 3) {
      min = digitsOnly.slice(0, 1).padStart(2, '0');
      sec = digitsOnly.slice(1);
    } else if (digitsOnly.length === 4) {
      min = digitsOnly.slice(0, 2);
      sec = digitsOnly.slice(2);
    } else if (digitsOnly.length > 0) {
      min = digitsOnly.padStart(2, '0');
      sec = '00';
    }

    const newTabs = tabs.map((t) => {
      if (t.id === activeTabId) {
        return {
          ...t,
          rows: t.rows.map((r) =>
            r.id === rowId ? { ...r, min, sec, rawTime: digitsOnly } : r
          ),
        };
      }
      return t;
    });

    setTabs(newTabs);
    saveToGas(newTabs);
    setEditingTimeRowId(null);
  };

  const handleRowBlur = () => {
    saveToGas(tabs);
  };

  const handleDeleteRow = (rowId) => {
    const newTabs = tabs.map((t) => {
      if (t.id === activeTabId) {
        return { ...t, rows: t.rows.filter((r) => r.id !== rowId) };
      }
      return t;
    });
    updateTabsWithSave(newTabs);
  };

  const handleSortRows = () => {
    const newTabs = tabs.map((t) => {
      if (t.id === activeTabId) {
        const sortedRows = [...t.rows].sort((a, b) => {
          const timeA = `${a.min}:${a.sec}`;
          const timeB = `${b.min}:${b.sec}`;
          return timeA.localeCompare(timeB);
        });
        return { ...t, rows: sortedRows };
      }
      return t;
    });
    updateTabsWithSave(newTabs);
    showToast('時間順に並び替えました');
  };

  const getDisplayTime = (row) => {
    const raw = row.rawTime !== undefined ? row.rawTime : '';
    if (raw.length === 3) {
      return `${raw.slice(0, 1)}:${raw.slice(1)}`;
    } else if (raw.length === 4) {
      return `${raw.slice(0, 2)}:${raw.slice(2)}`;
    } else if (raw.length > 0 && raw.length <= 2) {
      return `${raw}:00`;
    }
    return `${row.min || '00'}:${row.sec || '00'}`;
  };

  const tabToDelete = tabs.find((t) => t.id === deleteModalTabId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-50 text-gray-500">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
        <p className="font-bold">スプレッドシートから読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      {/* 固定ヘッダーエリア */}
      <div className="flex-shrink-0 sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        {/* タブ一覧 */}
        <div className="flex items-end overflow-x-auto hide-scrollbar px-2 pt-2 border-b border-gray-100">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              draggable
              onDragStart={(e) => handleDragStart(e, tab.id)}
              onDragOver={(e) => handleDragOver(e, tab.id)}
              onDragEnd={handleDragEnd}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors border border-b-0 cursor-pointer ${
                activeTabId === tab.id
                  ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
              } mr-1 group`}
            >
              <span>
                {tab.title.substring(0, 10)}
                {tab.title.length > 10 ? '...' : ''}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteModalTabId(tab.id);
                }}
                className={`w-4 h-4 rounded-full flex items-center justify-center text-xs opacity-60 hover:opacity-100 transition-opacity ${
                  activeTabId === tab.id
                    ? 'hover:bg-blue-600 text-white'
                    : 'hover:bg-gray-300 text-gray-600'
                }`}
                title="シートを削除"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={handleAddTab}
            className="px-3 py-2 text-sm font-bold text-blue-500 whitespace-nowrap mb-1 hover:bg-blue-50 rounded"
          >
            ＋ 追加
          </button>
        </div>

        {/* タイトル ＋ 操作ボタンエリア */}
        <div className="p-2.5 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <input
              type="text"
              value={activeTab ? activeTab.title : ''}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              placeholder="楽曲名・バージョンを入力"
              className="w-full text-base font-bold bg-transparent outline-none placeholder-gray-400 truncate"
            />
            {isSaving && (
              <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
                保存中...
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleAddRow}
              className="px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded shadow-sm active:bg-blue-700 transition-colors flex items-center gap-1"
              title="新規指示を追加"
            >
              <span>＋指示追加</span>
            </button>

            <button
              onClick={handleSortRows}
              className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded border border-gray-300 active:bg-gray-300 transition-colors flex items-center gap-1"
              title="時間順にソート"
            >
              <span>時間ソート</span>
            </button>

            <button
              onClick={() => fetchLatestData(true)}
              disabled={isRefreshing}
              className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded shadow-sm active:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center gap-1"
              title="スプレッドシートから最新化"
            >
              {isRefreshing ? (
                <span className="inline-block animate-spin">🔄</span>
              ) : (
                <span>シート更新</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 修正指示リスト */}
      <main className="flex-1 overflow-y-auto p-2 space-y-2 pb-8">
        {!activeTab || !activeTab.rows || activeTab.rows.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            まだ修正指示がありません。
            <br />
            右上ヘッダーの「＋指示追加」ボタンから追加してください。
          </div>
        ) : (
          activeTab.rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-row items-center gap-1.5 p-2 bg-white rounded-lg shadow-sm border border-gray-100"
            >
              {/* 入力者 */}
              <div className="relative shrink-0 flex items-center bg-gray-50 border border-gray-200 rounded px-1 h-8">
                <select
                  className="bg-transparent text-lg pr-3 appearance-none focus:outline-none cursor-pointer"
                  value={row.user}
                  onChange={(e) =>
                    handleUpdateRow(row.id, 'user', e.target.value)
                  }
                  onBlur={handleRowBlur}
                >
                  {USERS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <span className="absolute right-1 text-[8px] text-gray-400 pointer-events-none">
                  ▼
                </span>
              </div>

              {/* 時間指定（数字直接編集＆タップ時自動全選択） */}
              <div className="flex shrink-0 items-center justify-center h-8 bg-gray-50 border border-gray-200 rounded px-1 w-20">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  value={
                    editingTimeRowId === row.id
                      ? editingTimeValue
                      : getDisplayTime(row)
                  }
                  onFocus={(e) => handleTimeFocus(e, row)}
                  onChange={handleTimeChange}
                  onBlur={() => handleTimeBlur(row.id)}
                  className="w-full bg-transparent text-base text-center font-mono outline-none font-medium tracking-wide"
                />
              </div>

              {/* パート指定 */}
              <div
                className={`relative shrink-0 flex items-center border rounded px-1.5 h-8 transition-colors ${
                  PART_STYLES[row.part] || PART_STYLES['全体']
                }`}
              >
                <select
                  className="bg-transparent text-xs pr-3 appearance-none focus:outline-none font-bold cursor-pointer text-center"
                  value={row.part}
                  onChange={(e) =>
                    handleUpdateRow(row.id, 'part', e.target.value)
                  }
                  onBlur={handleRowBlur}
                >
                  {PARTS.map((p) => (
                    <option
                      key={p}
                      value={p}
                      className="bg-white text-gray-800 font-normal"
                    >
                      {p}
                    </option>
                  ))}
                </select>
                <span className="absolute right-1 text-[8px] opacity-60 pointer-events-none">
                  ▼
                </span>
              </div>

              {/* 修正内容テキスト */}
              <textarea
                className="flex-grow text-base md:text-sm bg-transparent border-b border-gray-200 focus:border-blue-500 focus:outline-none resize-none px-1 py-1 min-h-[32px] overflow-hidden"
                rows="1"
                placeholder="修正内容..."
                value={row.text}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = `${Math.max(32, el.scrollHeight)}px`;
                  }
                }}
                onChange={(e) => {
                  handleUpdateRow(row.id, 'text', e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.max(32, e.scrollHeight)}px`;
                }}
                onBlur={handleRowBlur}
              />

              {/* 行削除ボタン */}
              <button
                onClick={() => handleDeleteRow(row.id)}
                className="shrink-0 w-6 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors font-bold text-lg"
                title="行を削除"
              >
                ×
              </button>
            </div>
          ))
        )}
      </main>

      {/* シート削除確認モーダル */}
      {deleteModalTabId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <h3 className="text-base font-bold text-gray-800 mb-2">
              シートの削除
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              「
              <span className="font-semibold text-gray-900">
                {tabToDelete?.title}
              </span>
              」を削除してもよろしいですか？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteModalTabId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDeleteTab}
                className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors shadow-sm"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toastMessage && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-4 py-2 rounded-full shadow-lg transition-opacity z-50">
          {toastMessage}
        </div>
      )}

      {/* スタイル制御 */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `,
        }}
      />
    </div>
  );
}
