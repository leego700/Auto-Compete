import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Zap, Brain, Shield, Sofa, CarFront, Sparkles, AlertCircle, ChevronRight, Upload, FileText, Database, Copy, Edit, Save, Download, MessageSquare, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI } from '@google/genai';
import * as XLSX from 'xlsx';
import { marked } from 'marked';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DIMENSIONS = [
  { id: 'power', label: '动力', icon: Zap },
  { id: 'smart', label: '智能', icon: Brain },
  { id: 'safety', label: '安全', icon: Shield },
  { id: 'comfort', label: '舒适', icon: Sofa },
];

interface CarInfo {
  id: string;
  name: string;
}

interface AnalysisData {
  comparisonTable: string;
  summary: string;
  strategy: string;
}


export default function App() {
  const [heroCar, setHeroCar] = useState<CarInfo>({ id: 'hero', name: '' });
  const [competitors, setCompetitors] = useState<CarInfo[]>([
    { id: crypto.randomUUID(), name: '' }
  ]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['smart', 'safety']);
  const [referenceContent, setReferenceContent] = useState('');
  const [referenceFiles, setReferenceFiles] = useState<{name: string, mimeType: string, data: string}[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [followUpMsg, setFollowUpMsg] = useState('');
  
  // Edit states for sections
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isEditingStrategy, setIsEditingStrategy] = useState(false);
  
  const [error, setError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error("Failed to convert file to base64"));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const toggleDimension = (id: string) => {
    setSelectedDimensions(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const addCompetitor = () => {
    setCompetitors(prev => [...prev, { id: crypto.randomUUID(), name: '' }]);
  };

  const removeCompetitor = (id: string) => {
    setCompetitors(prev => prev.filter(c => c.id !== id));
  };

  const updateCompetitor = (id: string, name: string) => {
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, name } : c));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    let newContent = '';
    const newFiles: {name: string, mimeType: string, data: string}[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isText = file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.csv');
      
      if (isText) {
        try {
          const text = await file.text();
          newContent += `\n\n--- 文件内容：${file.name} ---\n${text}\n`;
        } catch (err) {
          console.error("Failed to read file", file.name);
        }
      } else {
        try {
          const base64 = await fileToBase64(file);
          // Set appropriate mime types for PPTX and DOCX if not correctly identified by browser
          let finalMimeType = file.type || 'application/octet-stream';
          if (file.name.endsWith('.docx')) {
            finalMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (file.name.endsWith('.pptx')) {
            finalMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          }
          
          newFiles.push({
            name: file.name,
            mimeType: finalMimeType,
            data: base64
          });
        } catch (error) {
          console.error("Failed to read file as base64", file.name);
        }
      }
    }
    
    if (newContent) setReferenceContent(prev => prev + newContent);
    if (newFiles.length > 0) setReferenceFiles(prev => [...prev, ...newFiles]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachedFile = (index: number) => {
    setReferenceFiles(prev => prev.filter((_, i) => i !== index));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportTableToExcel = (markdownTable: string) => {
    const lines = markdownTable.split('\n');
    const aoa: any[][] = [];
    lines.forEach(line => {
      let trimmed = line.trim();
      if (!trimmed.startsWith('|')) return;
      if (trimmed.includes('---')) return; // header separator
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      aoa.push(cells);
    });
    
    if (aoa.length === 0) return;
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, "产品力对比");
    XLSX.writeFile(wb, "核心参数对比表.xlsx");
  };

  const exportToWord = async (markdown: string, filename: string) => {
    const htmlContent = await marked(markdown);
    const wordDocument = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${filename}</title></head>
        <body>${htmlContent}</body>
      </html>
    `;
    const blob = new Blob([wordDocument], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateAnalyzePrompt = () => {
    const dimLabels = DIMENSIONS.filter(d => selectedDimensions.includes(d.id)).map(d => d.label).join('、');
    let prompt = `你是一位严谨的汽车行业产品规划与营销策略专家。请使用提供给你的参考资料，结合你的知识库和网络检索，帮我分析以下车型的产品力优劣势。\n\n`;
    
    prompt += `**【特别指令：交叉验证与二次校对机制】**\n`;
    prompt += `对于我提供的所有参考资料（包括文字文件、PDF/Word文档、网页链接等），你必须执行深度解析与二次校对：\n`;
    prompt += `1. **第一次提取**：全面检索网页链接或文档内容，提取我们重点对比的本品及所有竞品名称和核心参数。\n`;
    prompt += `2. **第二次校对**：将提取结果与原文链接/文档**重新交叉对比**，确保各项参数绝对真实、准确无偏。如果资料中确系缺失某项参数，请注明“未披露”或留空，**绝不允许凭空捏造、臆断或使用错误的数据**。\n\n`;

    prompt += `**【本品】（我方主推车型）**\n`;
    prompt += `- 车型名称：${heroCar.name || '未命名本品'}\n`;
    
    prompt += `\n**【竞品】（主要竞争对手）**\n`;
    competitors.forEach((comp, idx) => {
      prompt += `${idx + 1}. 竞品名称：${comp.name || '未命名竞品'}\n`;
    });
    
    prompt += `\n**【对比维度】**\n`;
    prompt += `本次分析重点聚焦于以下核心维度：${dimLabels}。\n\n`;
    
    if (referenceContent.trim() || referenceFiles.length > 0) {
      prompt += `**【参考资料】（极其重要：必须严格按照以下及附件中的资料进行分析和提取参数）**\n`;
      if (referenceContent.trim()) {
        prompt += `${referenceContent}\n\n`;
      }
    }
    
    prompt += `**【输出格式要求：必须输出严格的JSON格式】**\n`;
    prompt += `请返回如下结构的JSON (MIME Type: application/json)：\n`;
    prompt += `{\n`;
    prompt += `  "comparisonTable": "基于实际参数的分维度对比表(纯Markdown格式)",\n`;
    prompt += `  "summary": "一句话优劣势总结(纯Markdown格式)",\n`;
    prompt += `  "strategy": "主打卖点与差异化营销策略(纯Markdown格式)"\n`;
    prompt += `}\n`;
    prompt += `注意：JSON内容要求使用纯文本格式，除JSON外不要输出任何额外的文字思考过程，保证可以直接被JSON.parse解析。\n\n`;

    prompt += `**【输出内容要求】**\n`;
    prompt += `1. **基于实际参数的分维度对比表(comparisonTable)**：针对所选的 ${dimLabels} 维度，**必须严格按照上述参考资料**，生成本品与各竞品的横向对比表格。**请归类到对应的大维度下**。再次强调：不要凭空捏造。\n`;
    prompt += `2. **一句话优劣势总结(summary)**：针对对比的每一个大维度，分别用一句话精炼总结本品的绝对优势和明显劣势。\n`;
    prompt += `3. **主打卖点与差异化营销策略(strategy)**：提炼出3-5条本品最具杀伤力的主打卖点，并给出具体打法及话术。\n`;
    
    return prompt;
  };

  const handleAnalyze = async () => {
    if (!heroCar.name.trim()) {
      setError('请输入本品车型名称');
      return;
    }
    if (competitors.every(c => !c.name.trim())) {
      setError('请至少输入一款具有名称的竞品车型');
      return;
    }
    if (selectedDimensions.length === 0) {
      setError('请至少选择一个对比维度');
      return;
    }

    setError('');
    setIsAnalyzing(true);
    setAnalysisResult('');
    setAnalysisData(null);

    const promptText = generateAnalyzePrompt();
    const parts: any[] = [{ text: promptText }];
    
    referenceFiles.forEach(f => {
      parts.push({
        inlineData: {
          mimeType: f.mimeType,
          data: f.data
        }
      });
    });

    const newHistory = [{ role: 'user', parts }];

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: newHistory,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text || "{}";
      try {
        const json = JSON.parse(text);
        setAnalysisData(json);
        setConversationHistory([...newHistory, { role: 'model', parts: [{ text }] }]);
      } catch (parseErr) {
        console.error("JSON parse failed", text);
        setError('模型返回的数据格式异常，请重试。');
      }
    } catch (err: any) {
      setError('分析过程中出现错误：' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFollowUp = async () => {
    if (!followUpMsg.trim() || !analysisData) return;
    
    setError('');
    setIsAnalyzing(true);

    const newMsg = {
      role: 'user',
      parts: [{ text: `我们在以上内容的上下文下继续探讨。用户新的要求或输入：\n\n${followUpMsg}\n\n请严格返回和之前一样的JSON对象结构，在之前内容基础上修改/扩充：{"comparisonTable": "...", "summary": "...", "strategy": "..."}` }]
    };

    const newHistory = [...conversationHistory, newMsg];

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: newHistory,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text || "{}";
      try {
        const json = JSON.parse(text);
        setAnalysisData(json);
        setConversationHistory([...newHistory, { role: 'model', parts: [{ text }] }]);
      } catch (parseErr) {
        console.error("JSON parse failed", text);
        setError('模型返回的数据格式异常，请重试。');
      }
    } catch (err: any) {
      setError('后续对话中出现错误：' + err.message);
    } finally {
      setIsAnalyzing(false);
      setFollowUpMsg('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <CarFront className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">AutoCompete Pro</h1>
          </div>
          <p className="text-sm text-slate-500 hidden sm:block">车型产品力对比与策略提炼工具</p>
        </div>
      </header>

      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3 mb-6">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Inputs & Config */}
          <div className="lg:col-span-4 space-y-6 flex flex-col">
            
            {/* 1. Dimension Selection */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-sm">1</span>
                分析维度定调
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {DIMENSIONS.map(dim => {
                  const Icon = dim.icon;
                  const isSelected = selectedDimensions.includes(dim.id);
                  return (
                    <button
                      key={dim.id}
                      onClick={() => toggleDimension(dim.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm' 
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                      {dim.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Cars Setup */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-sm">2</span>
                出战车型设定
              </h2>
              <div className="space-y-5">
                {/* Hero Car */}
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <label className="block text-sm font-bold text-blue-900 mb-2">本品 (我方主推) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={heroCar.name}
                    onChange={(e) => setHeroCar({ ...heroCar, name: e.target.value })}
                    placeholder="例如：小米SU7 Max"
                    className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-white"
                  />
                </div>

                {/* Competitors */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-slate-700">竞品阵列 <span className="text-red-500">*</span></label>
                    <button 
                      onClick={addCompetitor}
                      className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> 新增竞品
                    </button>
                  </div>
                  <div className="space-y-3">
                    {competitors.map((comp, index) => (
                      <div key={comp.id} className="relative flex items-center gap-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={comp.name}
                            onChange={(e) => updateCompetitor(comp.id, e.target.value)}
                            placeholder={`竞品 ${index + 1} (例如：极氪001)`}
                            className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-shadow"
                          />
                        </div>
                        {competitors.length > 1 && (
                          <button 
                            onClick={() => removeCompetitor(comp.id)}
                            className="text-slate-400 hover:text-red-500 p-2 transition-colors"
                            title="删除竞品"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Reference Database */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-sm">3</span>
                  统一参考资料库
                </h2>
                <div>
                  <input 
                    type="file" 
                    multiple 
                    accept=".txt,.md,.csv,.json,.pdf,.doc,.docx,.ppt,.pptx"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors border border-slate-200 flex items-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    上传文档
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                您可以直接粘贴新闻链接、网页网址，或填入竞品参数、对比文章等文本内容。AI将据此执行精准分析。
              </p>
              <div className="flex-1 relative flex flex-col">
                {referenceFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {referenceFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 pl-3 pr-2 py-1.5 rounded-lg text-sm border border-blue-100 shadow-sm transition-all hover:shadow-md">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="truncate max-w-[150px] font-medium" title={f.name}>{f.name}</span>
                        <button 
                          onClick={() => removeAttachedFile(i)}
                          className="text-blue-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-colors"
                          title="删除附件"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative flex-1">
                  <textarea
                    value={referenceContent}
                    onChange={(e) => setReferenceContent(e.target.value)}
                    placeholder="在此输入参考链接（如 https://...）或直接粘贴相关信息内容..."
                    className="w-full h-full min-h-[220px] px-4 py-3 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-slate-50 transition-shadow"
                  />
                  {!referenceContent && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10">
                      <Database className="w-24 h-24" />
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Analyze Action */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className={`w-full py-4 rounded-2xl text-white font-semibold text-lg shadow-lg flex items-center justify-center gap-2 transition-all shrink-0 ${
                isAnalyzing 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:-translate-y-0.5'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  深度计算与策略生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  提炼核心产品力与话术
                </>
              )}
            </button>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {!analysisData && !isAnalyzing ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 transition-opacity duration-300 h-full min-h-[600px] flex flex-col items-center justify-center text-center py-20 opacity-50">
                <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                  <Brain className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3">策略研判中枢</h3>
                <p className="text-slate-500 max-w-md text-base">
                  就绪完毕后，核心维度对比表格、优势防御策略及差异化营销话术将在此处呈现。
                </p>
              </div>
            ) : isAnalyzing && !analysisData ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 transition-opacity duration-300 h-full min-h-[600px] flex flex-col items-center justify-center py-20">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="w-20 h-20 bg-slate-100 rounded-2xl animate-pulse delay-75" />
                  ))}
                </div>
                <div className="flex flex-col items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-700 animate-pulse">正在拆解产品力数据引擎...</h3>
                  <p className="text-slate-400 text-sm">正在检索网络信息与对比参数，请稍候</p>
                </div>
              </div>
            ) : analysisData ? (
              <>
                {/* 1. Comparison Table Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-600" />
                      核心参数对比表
                    </h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsEditingTable(!isEditingTable)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        {isEditingTable ? <Save className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                        {isEditingTable ? '保存' : '编辑'}
                      </button>
                      <button onClick={() => copyToClipboard(analysisData.comparisonTable)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Copy className="w-4 h-4" /> 复制
                      </button>
                      <button onClick={() => exportTableToExcel(analysisData.comparisonTable)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-100/50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200">
                        <Download className="w-4 h-4" /> Excel导出
                      </button>
                    </div>
                  </div>
                  <div className="p-6 overflow-x-auto">
                    {isEditingTable ? (
                      <textarea 
                        value={analysisData.comparisonTable} 
                        onChange={(e) => setAnalysisData({...analysisData, comparisonTable: e.target.value})}
                        className="w-full h-[400px] p-4 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    ) : (
                      <div className="prose prose-slate prose-blue max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                          table: ({node, ...props}) => <table className="w-full text-sm text-left whitespace-nowrap min-w-full" {...props} />,
                          thead: ({node, ...props}) => <thead className="bg-slate-50 text-slate-700 uppercase" {...props} />,
                          th: ({node, ...props}) => <th className="px-6 py-4 font-bold border-b border-slate-200 bg-slate-50 text-slate-800" {...props} />,
                          td: ({node, ...props}) => <td className="px-6 py-4 border-b border-slate-100 whitespace-nowrap" {...props} />,
                        }}>{analysisData.comparisonTable}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Summary Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-indigo-600" />
                      优劣势总结
                    </h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsEditingSummary(!isEditingSummary)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        {isEditingSummary ? <Save className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                        {isEditingSummary ? '保存' : '编辑'}
                      </button>
                      <button onClick={() => copyToClipboard(analysisData.summary)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Copy className="w-4 h-4" /> 复制
                      </button>
                      <button onClick={() => exportToWord(analysisData.summary, "优劣势总结")} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-100/50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200">
                        <Download className="w-4 h-4" /> Word导出
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    {isEditingSummary ? (
                      <textarea 
                        value={analysisData.summary} 
                        onChange={(e) => setAnalysisData({...analysisData, summary: e.target.value})}
                        className="w-full h-[200px] p-4 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    ) : (
                      <div className="prose prose-slate prose-blue max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisData.summary}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Strategy Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      主打卖点与差异化营销策略
                    </h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIsEditingStrategy(!isEditingStrategy)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        {isEditingStrategy ? <Save className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                        {isEditingStrategy ? '保存' : '编辑'}
                      </button>
                      <button onClick={() => copyToClipboard(analysisData.strategy)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Copy className="w-4 h-4" /> 复制
                      </button>
                      <button onClick={() => exportToWord(analysisData.strategy, "营销策略")} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-600 bg-amber-100/50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200">
                        <Download className="w-4 h-4" /> Word导出
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    {isEditingStrategy ? (
                      <textarea 
                        value={analysisData.strategy} 
                        onChange={(e) => setAnalysisData({...analysisData, strategy: e.target.value})}
                        className="w-full h-[300px] p-4 text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    ) : (
                      <div className="prose prose-slate prose-blue max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisData.strategy}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {/* Feedback Chat Box */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky bottom-6 z-10 shadow-xl shadow-slate-200/50">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    补充调整与二轮对话
                  </h3>
                  <div className="flex gap-3">
                    <input 
                      type="text"
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                      placeholder="觉得对比有遗漏或不准确的地方？在此输入您的调整意见，AI将为您重新生成内容..."
                      value={followUpMsg}
                      onChange={e => setFollowUpMsg(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleFollowUp()}
                    />
                    <button 
                      onClick={handleFollowUp}
                      disabled={isAnalyzing || !followUpMsg.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 shrink-0"
                    >
                      {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                      发送修改
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
