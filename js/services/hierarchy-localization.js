define([], function () {
    const messages = {
        en: {
            analyze: "Analyze Parent links",
            analyzing: "Analyzing…",
            dismiss: "Dismiss error",
            checkedChains: "Checked Parent chains",
            openItem: "Open #{id}",
            found: "Found a Parent link that can prevent backlog reordering.",
            incomplete: "The analysis is incomplete. No invalid Parent link was confirmed in the items checked.",
            none: "No invalid Parent link was confirmed in the items checked.",
            failed: "The analysis could not finish. Try again or check read permissions.",
            sameCategory: "both work items are in the same backlog category",
            reversedParent: "the parent is in a lower backlog category than the child",
            parentCycle: "this link closes a Parent cycle",
            finding: "{child} -> {parent}. {reason}. Open #{childId} and check Links > Parent (#{parentId}). Correct this Parent link, or use Related for a non-hierarchical association.",
            chainFrom: "Parent chain from #{id}",
            itemLimit: "The analysis reached its work item limit. Check the Parent of the last item shown.",
            missingItem: "This work item was not returned. It may have been removed or access may be restricted.",
            ambiguousParent: "The Parent links could not be read unambiguously.",
            accessDenied: "Access was denied. Check your permission to read this work item.",
            notFound: "This work item was not found or is inaccessible.",
            lookupFailed: "The Parent lookup failed. {reason}",
            lookupRetry: "Try the analysis again or check your connection and read permissions.",
            lookupDetail: "Lookup error (original): {detail}",
            warning: "#{id}. {reason}",
            crossProject: "An ancestor belongs to another project. Its backlog categories need to be checked in that project.",
            unknownCategory: "Some work item types have no known backlog category. Their Parent links need to be checked in the project's process settings.",
            timeLimit: "The analysis reached its time limit. The chains shown may be incomplete. You can run the analysis again.",
            categoryFailed: "Backlog categories could not be loaded. Category checks are incomplete; Parent chains are still read.",
            missingProject: "The current project could not be identified."
        },
        ja: {
            analyze: "親子関係を解析",
            analyzing: "解析中…",
            dismiss: "エラーを閉じる",
            checkedChains: "確認した親階層",
            openItem: "#{id} を開く",
            found: "並べ替えを妨げる可能性のある親子関係が見つかりました。",
            incomplete: "解析は一部未完了です。確認できた範囲では、不正な親子関係は確認できませんでした。",
            none: "確認した範囲では、不正な親子関係は確認できませんでした。",
            failed: "解析を完了できませんでした。もう一度実行するか、閲覧権限を確認してください。",
            sameCategory: "親と子が同じバックログ階層に属しています",
            reversedParent: "親のバックログ階層が子より下位になっています",
            parentCycle: "このリンクにより親子関係が循環しています",
            finding: "{child} → {parent}。{reason}。#{childId} を開き、リンク（Links）の親（Parent）が #{parentId} になっていることを確認してください。親リンクを修正するか、親子関係でない関連付けには関連（Related）リンクを使用してください。",
            chainFrom: "#{id} からたどった親階層",
            itemLimit: "解析対象の件数上限に達しました。表示された最後の項目の親（Parent）を確認してください。",
            missingItem: "この Work Item を取得できませんでした。削除されているか、閲覧権限が制限されている可能性があります。",
            ambiguousParent: "親（Parent）リンクを一意に読み取れませんでした。",
            accessDenied: "アクセスが拒否されました。この Work Item の閲覧権限を確認してください。",
            notFound: "この Work Item が見つからないか、アクセスできません。",
            lookupFailed: "親（Parent）の取得に失敗しました。{reason}",
            lookupRetry: "もう一度解析するか、接続状況と閲覧権限を確認してください。",
            lookupDetail: "取得エラーの原文：{detail}",
            warning: "#{id}：{reason}",
            crossProject: "別のプロジェクトに属する祖先があります。そのプロジェクトのバックログ階層設定を確認してください。",
            unknownCategory: "バックログ階層が不明な Work Item の種類があります。プロジェクトのプロセス設定で親子関係を確認してください。",
            timeLimit: "解析の制限時間に達しました。表示された親階層は途中までの可能性があります。もう一度解析できます。",
            categoryFailed: "バックログ階層を取得できませんでした。階層の判定は一部未完了ですが、親リンクの取得は続行します。",
            missingProject: "現在のプロジェクトを特定できませんでした。"
        }
    };

    const normalize = (culture) => typeof(culture) === "string" && /^ja(?:-|$)/i.test(culture.trim().replace(/_/g, "-")) ? "ja" : "en";

    // Use the user's Azure DevOps page context, never the browser language.
    // Call after SDK.ready(); unavailable contexts safely retain English.
    const getLanguage = function (sdk) {
        try {
            const context = sdk && typeof(sdk.getPageContext) === "function" ? sdk.getPageContext() : null;
            return normalize(context && context.globalization && context.globalization.culture);
        }
        catch (error) {
            return "en";
        }
    };

    const text = function (culture, key, values = {}) {
        const catalog = messages[normalize(culture)];
        const own = (object, name) => Object.prototype.hasOwnProperty.call(object, name);
        const template = own(catalog, key) ? catalog[key] : own(messages.en, key) ? messages.en[key] : key;
        return template.replace(/\{(\w+)\}/g, (match, name) => own(values, name) ? String(values[name]) : match);
    };

    return { normalize, getLanguage, text };
});
