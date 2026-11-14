// 所有内容集中在此修改；资源路径相对于 index.html，也支持 HTTPS 直链。
window.PORTFOLIO = {
  name: "陈珂羽",
  intro: "你好，我是陈珂羽。在这里，分享我的影像与剪辑创作。",
  bio: "关注生活中的细节与情绪，用流畅的剪辑和 AI 创意，让每一段影像讲好一个故事。",
  portrait: "assets/chen-keyu.png", // 留空时显示照片预留区域。
  focus: "信息类 / 口播类 / AI 类 / 卡点类",
  software: ["剪映"],
  skills: ["熟悉 AI 工具", "剪辑", "运营", "学习能力强"],
  email: "", // 填入真实邮箱后启用邮件联系。
  socials: [
    { label: "BILIBILI", account: "[你的账号]", url: "" },
    { label: "小红书", account: "[你的账号]", url: "" },
    { label: "WEIBO", account: "[你的账号]", url: "" }
  ],
  categories: [
    { id: "information", title: "信息类", english: "INFORMATION", description: "信息类视频剪辑作品。" },
    { id: "talking", title: "口播类", english: "TALKING HEAD", description: "口播类视频剪辑作品。" },
    { id: "ai", title: "AI 类", english: "AI FILMS", description: "AI 类影像作品。" },
    { id: "beat", title: "卡点类", english: "BEAT EDITS", description: "以音乐节奏串联画面，呈现卡点剪辑作品。" }
  ],
  // 为已有本地作品库追加这批作品；批次只应用一次，保留编辑与删除。
  bundledImports: [
    { id: "beat-2026-11-14", workIds: ["beat-01", "beat-02"] },
    { id: "information-2026-11-14-02", workIds: ["information-02"] }
  ],
  // 复制对象添加作品；id 唯一，category 对应上面的分类 id。
  // video 填 MP4 / WebM 直链或本地路径，不填网页播放页。
  // 封面为对应视频的实际画面，封面和视频可分别替换。
  works: [
    {
      id: "information-01", category: "information", title: "信息类作品 01",
      subtitle: "信息类 · 00:19", description: "[作品简介待填写]",
      cover: "assets/information-01.jpg", videoPoster: "assets/information-01.jpg",
      video: "assets/information-01.mp4", aspectRatio: "888 / 1080", portrait: true,
      tags: ["信息类"], software: [], demo: false
    },
    {
      id: "information-02", category: "information", title: "信息类作品 02",
      subtitle: "信息类 · 00:17", description: "[作品简介待填写]",
      cover: "assets/information-02.jpg", videoPoster: "assets/information-02.jpg",
      video: "assets/information-02.mp4", aspectRatio: "9 / 16", portrait: true, duration: 17.345011,
      videoName: "11月14日 (4)(1).mp4", tags: ["信息类"], software: [], demo: false
    },
    {
      id: "talking-01", category: "talking", title: "口播类作品 01",
      subtitle: "口播类 · 00:30", description: "[作品简介待填写]",
      cover: "assets/talking-01.jpg", videoPoster: "assets/talking-01.jpg",
      video: "assets/talking-01.mp4", aspectRatio: "720 / 1122", portrait: true,
      tags: ["口播类"], software: [], demo: false
    },
    {
      id: "talking-02", category: "talking", title: "口播类作品 02",
      subtitle: "口播类 · 00:30", description: "[作品简介待填写]",
      cover: "assets/talking-02.jpg", videoPoster: "assets/talking-02.jpg",
      video: "assets/talking-02.mp4", aspectRatio: "720 / 1130", portrait: true,
      tags: ["口播类"], software: [], demo: false
    },
    {
      id: "ai-01", category: "ai", title: "AI 作品 01",
      subtitle: "AI 类 · 00:39", description: "[作品简介待填写]",
      cover: "assets/ai-01.jpg", videoPoster: "assets/ai-01.jpg",
      video: "assets/ai-01.mp4", aspectRatio: "16 / 9", portrait: false,
      tags: ["AI 类"], software: [], demo: false
    },
    {
      id: "ai-02", category: "ai", title: "AI 作品 02",
      subtitle: "AI 类 · 00:15", description: "[作品简介待填写]",
      cover: "assets/ai-02.jpg", videoPoster: "assets/ai-02.jpg",
      video: "assets/ai-02.mp4", aspectRatio: "16 / 9", portrait: false,
      tags: ["AI 类"], software: [], demo: false
    },
    {
      id: "beat-01", category: "beat", title: "卡点作品 01",
      subtitle: "卡点类 · 00:15", description: "[作品简介待填写]",
      cover: "assets/beat-01.jpg", videoPoster: "assets/beat-01.jpg",
      video: "assets/beat-01.mp4", aspectRatio: "16 / 9", portrait: false, duration: 14.651995,
      videoName: "11月14日.mp4", tags: ["卡点类"], software: [], demo: false
    },
    {
      id: "beat-02", category: "beat", title: "卡点作品 02",
      subtitle: "卡点类 · 00:17", description: "[作品简介待填写]",
      cover: "assets/beat-02.jpg", videoPoster: "assets/beat-02.jpg",
      video: "assets/beat-02.mp4", aspectRatio: "16 / 9", portrait: false, duration: 17.066667,
      videoName: "11月14日 (2).mp4", tags: ["卡点类"], software: [], demo: false
    }
  ]
};
