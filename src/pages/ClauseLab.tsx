import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Sparkles, AlertTriangle, Lightbulb, Scale, Loader2, BookOpen, Upload, X, CheckCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { analyzeClauseRuleBased } from "@/services/ruleBasedExtractor";
import { extractTextFromPDF } from "@/services/pdfParser";

interface AnalysisResult {
  risks: string[];
  improvements: string[];
  alternatives: string[];
  balance: {
    score: number;
    explanation: string;
  };
  compliance?: {
    status: string;
    findings: string[];
    recommendations: string[];
  };
}

interface Playbook {
  name: string;
  content: string;
}

export default function ClauseLab() {
  const [clauseText, setClauseText] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [analysisMethod, setAnalysisMethod] = useState<'rule-based'>('rule-based');
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [isLoadingPlaybook, setIsLoadingPlaybook] = useState(false);
  const playbookInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handlePlaybookUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoadingPlaybook(true);

    try {
      let content: string;

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        content = await extractTextFromPDF(file);
      } else {
        content = await file.text();
      }

      setPlaybook({
        name: file.name,
        content,
      });

      toast({
        title: "Playbook loaded",
        description: `Successfully loaded ${file.name}`,
      });
    } catch (error) {
      console.error('Error loading playbook:', error);
      toast({
        title: "Error loading playbook",
        description: error instanceof Error ? error.message : "Failed to load playbook",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPlaybook(false);
      if (playbookInputRef.current) {
        playbookInputRef.current.value = '';
      }
    }
  };

  const removePlaybook = () => {
    setPlaybook(null);
    setAnalysis(null);
  };

  const analyzeClause = async (action: 'analyze' | 'improve' | 'alternatives' | 'balance' | 'compliance') => {
    if (!clauseText.trim()) {
      toast({
        title: "No clause text",
        description: "Please enter a clause to analyze.",
        variant: "destructive",
      });
      return;
    }

    if (action === 'compliance' && !playbook) {
      toast({
        title: "No playbook loaded",
        description: "Please upload a playbook to check compliance.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setActiveAction(action);

      try {
        const data = analyzeClauseRuleBased(clauseText, action);

        setAnalysis(prev => ({
        risks: action === 'analyze' ? data.risks : prev?.risks || [],
        improvements: action === 'improve' ? data.improvements : prev?.improvements || [],
        alternatives: action === 'alternatives' ? data.alternatives : prev?.alternatives || [],
        balance: action === 'balance' ? data.balance : prev?.balance || { score: 0, explanation: '' },
        compliance: action === 'compliance' ? data.compliance : prev?.compliance,
      }));

      toast({
        title: "Analysis complete",
        description: playbook ? "Clause analyzed according to playbook rules." : "Your clause has been analyzed successfully.",
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Failed to analyze clause.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  const getBalanceColor = (score: number) => {
    if (score < -2) return 'text-teal-400';
    if (score > 2) return 'text-blue-400';
    return 'text-zinc-400';
  };

  const getBalanceLabel = (score: number) => {
    if (score < -2) return 'Customer Favorable';
    if (score > 2) return 'Vendor Favorable';
    return 'Neutral';
  };

  const getComplianceColor = (status: string) => {
    if (status === 'compliant') return 'text-green-400 border-green-400';
    if (status === 'non-compliant') return 'text-red-400 border-red-400';
    return 'text-yellow-400 border-yellow-400';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold text-foreground mb-2">Contract & Clause Manager</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-8"
      >
        <div className="space-y-6">
          <Card className="bg-card border-border shadow-card">
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Select Clause</label>
                <Select defaultValue="confidentiality">
                  <SelectTrigger className="w-full bg-secondary border-border h-12">
                    <SelectValue placeholder="Select Clause" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confidentiality">Confidentiality</SelectItem>
                    <SelectItem value="indemnification">Indemnification</SelectItem>
                    <SelectItem value="liability">Limitation of Liability</SelectItem>
                    <SelectItem value="termination">Termination</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Your Position</label>
                <Select defaultValue="neutral">
                  <SelectTrigger className="w-full bg-secondary border-border h-12">
                    <SelectValue placeholder="Select Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="favorable">Customer Favorable</SelectItem>
                    <SelectItem value="neutral">Neutral</SelectItem>
                    <SelectItem value="vendor">Vendor Favorable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          <Button 
            onClick={() => analyzeClause('analyze')}
            disabled={loading}
            className="w-32 bg-primary hover:bg-primary/90 text-primary-foreground h-11 rounded-md font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit"}
          </Button>
        </div>

        <Card className="bg-card border-border shadow-card h-full">
          <CardContent className="pt-6 h-[calc(100%-24px)] flex flex-col">
            <label className="text-sm font-medium text-muted-foreground mb-2">Enter Clause for Analysis (Optional)</label>
            <Textarea
              value={clauseText}
              onChange={(e) => setClauseText(e.target.value)}
              placeholder="Paste your clause here..."
              className="flex-grow min-h-[220px] bg-secondary border-border text-foreground resize-none p-4"
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Section */}
      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analysis.risks && analysis.risks.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Risks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.risks.map((risk, i) => (
                      <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                        <span className="text-amber-500 mt-1">•</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {analysis.improvements && analysis.improvements.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-emerald-500" />
                    Improvements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.improvements.map((improvement, i) => (
                      <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                        <span className="text-emerald-500 mt-1">•</span>
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
