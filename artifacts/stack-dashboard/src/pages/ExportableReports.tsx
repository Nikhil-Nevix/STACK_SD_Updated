import { useState, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, FileSpreadsheet, FileText, ArrowRight, Download, Eye } from "lucide-react";

export default function ExportableReports() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const triggerExport = useCallback(async (type: "csv" | "pdf", reportName: string, period: string) => {
    setIsExporting(`${reportName}-${type}`);
    try {
      const token = getToken();
      const params = new URLSearchParams({ period, date_from: dateFrom, date_to: dateTo });
      const endpoint = type === "csv" ? "/api/v1/reports/export?report_type=tickets" : "/api/v1/reports/export-pdf";
      
      const res = await fetch(`${endpoint}&${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (!res.ok) throw new Error("Failed to export report");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stack-${reportName.toLowerCase().replace(/\s+/g, "-")}-${period}-${dateFrom}-to-${dateTo}.${type}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(null);
    }
  }, [dateFrom, dateTo]);

  const reportsList = [
    {
      id: "sla-compliance",
      name: "SLA Compliance Report",
      description: "Aggregated SLA met, breached, and predicted breaches by use case",
      period: "monthly",
      icon: <Calendar className="w-5 h-5 text-indigo-500" />,
    },
    {
      id: "resolution-rate",
      name: "Resolution Performance Report",
      description: "Detailed metrics on auto-resolution success vs manual handling rates",
      period: "weekly",
      icon: <FileText className="w-5 h-5 text-emerald-500" />,
    },
    {
      id: "executive-summary",
      name: "Executive Service Summary",
      description: "Top level insights on tickets, AI accuracy, and overall time saved",
      period: "monthly",
      icon: <FileSpreadsheet className="w-5 h-5 text-orange-500" />,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent dark:from-white dark:to-slate-300">
            Exportable Reports
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate and export custom-configured compliance and performance summaries.
          </p>
        </div>

        {/* Global Date Filter */}
        <div className="flex flex-wrap items-center gap-3 bg-card/60 backdrop-blur-md p-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Filter Range:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-36 text-xs bg-background/50 border-slate-200"
            />
          </div>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-36 text-xs bg-background/50 border-slate-200"
          />
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportsList.map((report) => (
          <Card key={report.id} className="group relative overflow-hidden border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 bg-card/65 backdrop-blur-lg">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:scale-110 transition-transform duration-300">
                {report.icon}
              </div>
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors duration-200">
                  {report.name}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {report.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2 mb-2 dark:border-slate-800">
                  <span>Default Period:</span>
                  <span className="font-semibold capitalize text-foreground">{report.period}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                    onClick={() => triggerExport("csv", report.name, report.period)}
                    disabled={isExporting !== null}
                  >
                    {isExporting === `${report.name}-csv` ? (
                      <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    )}
                    CSV Data
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors"
                    onClick={() => triggerExport("pdf", report.name, report.period)}
                    disabled={isExporting !== null}
                  >
                    {isExporting === `${report.name}-pdf` ? (
                      <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    PDF Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Notice card */}
      <Card className="border-0 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-none">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg dark:text-indigo-400">
            <Eye className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-indigo-950 dark:text-indigo-300">Custom Reports Scheduling Available</h4>
            <p className="text-xs text-indigo-700 dark:text-indigo-400 leading-relaxed">
              Need these reports in your inbox daily or weekly? You can coordinate automated schedules using the 
              cron configurations in the STACK admin portal. Standard PDF exports compile audit logs, API usage lists, 
              and auto-resolution performance summaries.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
