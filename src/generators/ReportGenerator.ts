/**
 * ReportGenerator
 * 
 * 報告生成器 - 將分析結果轉換為 JSON 或 Markdown 格式的報告
 * 
 * Validates: Requirements 18.2, 18.4
 */

import { Logger } from '../utils/logger.js';
import type { ReportConfig } from '../types/report.js';
import type {
  PerformanceReport,
  CodeQualityReport,
  CompatibilityReport,
  Recommendation,
} from '../types/analysis.js';
import type { AssetAnalysisResult } from '../types/asset.js';

/**
 * Dashboard 輸入資料
 */
export interface DashboardData {
  assetAnalysis?: AssetAnalysisResult[];
  performanceReport?: PerformanceReport;
  codeQualityReport?: CodeQualityReport;
  compatibilityReport?: CompatibilityReport;
}

/**
 * ReportGenerator 類別
 * 
 * 支援 JSON 與 Markdown 兩種輸出格式，
 * 可生成資產報告、效能報告、程式碼品質報告、相容性報告與儀表板
 */
export class ReportGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ level: 'info' }, { module: 'ReportGenerator' });
  }

  /**
   * 生成資產分析報告
   */
  async generateAssetReport(analysis: AssetAnalysisResult[], config: ReportConfig): Promise<string> {
    this.logger.info('Generating asset report', { format: config.format, assetCount: analysis.length });

    const reportData = {
      title: 'Asset Analysis Report',
      timestamp: new Date().toISOString(),
      totalAssets: analysis.length,
      issuesSummary: {
        critical: 0,
        warning: 0,
        info: 0,
      },
      naniteCompatible: 0,
      totalEstimatedMemoryMB: 0,
      assets: analysis,
    };

    for (const asset of analysis) {
      for (const issue of asset.detectedIssues) {
        if (issue.severity === 'critical') reportData.issuesSummary.critical++;
        else if (issue.severity === 'warning') reportData.issuesSummary.warning++;
        else reportData.issuesSummary.info++;
      }
      if (asset.naniteCompatible) reportData.naniteCompatible++;
      reportData.totalEstimatedMemoryMB += asset.estimatedMemory;
    }

    if (config.format === 'json') {
      return JSON.stringify(reportData, null, 2);
    }

    return this.formatAssetReportMarkdown(reportData, analysis);
  }

  /**
   * 生成效能分析報告
   */
  async generatePerformanceReport(report: PerformanceReport, config: ReportConfig): Promise<string> {
    this.logger.info('Generating performance report', { format: config.format });

    if (config.format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    return this.formatPerformanceReportMarkdown(report);
  }

  /**
   * 生成程式碼品質報告
   */
  async generateCodeQualityReport(report: CodeQualityReport, config: ReportConfig): Promise<string> {
    this.logger.info('Generating code quality report', { format: config.format });

    if (config.format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    return this.formatCodeQualityReportMarkdown(report);
  }

  /**
   * 生成相容性報告
   */
  async generateCompatibilityReport(report: CompatibilityReport, config: ReportConfig): Promise<string> {
    this.logger.info('Generating compatibility report', { format: config.format });

    if (config.format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    return this.formatCompatibilityReportMarkdown(report);
  }

  /**
   * 生成儀表板（合併多份報告）
   */
  async generateDashboard(data: DashboardData): Promise<string> {
    this.logger.info('Generating dashboard');

    const lines: string[] = [];
    lines.push('# Project Health Dashboard');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    // Overall health
    lines.push('## Overall Health');
    lines.push('');

    const scores: { label: string; score: number }[] = [];

    if (data.performanceReport) {
      scores.push({ label: 'Performance', score: data.performanceReport.summary.overallScore });
    }
    if (data.codeQualityReport) {
      scores.push({ label: 'Code Quality', score: data.codeQualityReport.summary.overallScore });
    }
    if (data.compatibilityReport) {
      const compatScore = data.compatibilityReport.canBuild ? 80 : 30;
      const issuePenalty = data.compatibilityReport.blockingIssues.length * 10;
      scores.push({ label: 'Compatibility', score: Math.max(0, compatScore - issuePenalty) });
    }

    if (scores.length > 0) {
      const avgScore = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
      lines.push(`| Metric | Score |`);
      lines.push(`| --- | --- |`);
      for (const s of scores) {
        lines.push(`| ${s.label} | ${s.score}/100 |`);
      }
      lines.push(`| **Overall** | **${avgScore}/100** |`);
      lines.push('');
    } else {
      lines.push('No analysis data available.');
      lines.push('');
    }

    // Asset summary
    if (data.assetAnalysis && data.assetAnalysis.length > 0) {
      lines.push('## Asset Summary');
      lines.push('');
      const totalIssues = data.assetAnalysis.reduce((sum, a) => sum + a.detectedIssues.length, 0);
      const naniteCount = data.assetAnalysis.filter(a => a.naniteCompatible).length;
      lines.push(`- Total assets analyzed: ${data.assetAnalysis.length}`);
      lines.push(`- Total issues found: ${totalIssues}`);
      lines.push(`- Nanite compatible: ${naniteCount}`);
      lines.push('');
    }

    // Performance summary
    if (data.performanceReport) {
      const perf = data.performanceReport;
      lines.push('## Performance Summary');
      lines.push('');
      lines.push(`- Score: ${perf.summary.overallScore}/100`);
      lines.push(`- Critical issues: ${perf.summary.criticalIssues}`);
      lines.push(`- Warnings: ${perf.summary.warnings}`);
      lines.push(`- Estimated FPS: ${perf.summary.estimatedFps.low}-${perf.summary.estimatedFps.high}`);
      lines.push(`- Anti-patterns detected: ${perf.antiPatterns.length}`);
      lines.push('');
    }

    // Code quality summary
    if (data.codeQualityReport) {
      const cq = data.codeQualityReport;
      lines.push('## Code Quality Summary');
      lines.push('');
      lines.push(`- Score: ${cq.summary.overallScore}/100`);
      lines.push(`- Total issues: ${cq.summary.totalIssues}`);
      lines.push(`- Naming violations: ${cq.namingViolations.length}`);
      lines.push(`- Circular dependencies: ${cq.circularDependencies.length}`);
      lines.push(`- Architecture issues: ${cq.architectureIssues.length}`);
      lines.push('');
    }

    // Compatibility summary
    if (data.compatibilityReport) {
      const compat = data.compatibilityReport;
      lines.push('## Compatibility Summary');
      lines.push('');
      lines.push(`- Target platform: ${compat.targetPlatform}`);
      lines.push(`- Can build: ${compat.canBuild ? 'Yes' : 'No'}`);
      lines.push(`- Total issues: ${compat.issues.length}`);
      lines.push(`- Blocking issues: ${compat.blockingIssues.length}`);
      lines.push(`- Shader compatible: ${compat.shaderCompatibility.compatible ? 'Yes' : 'No'}`);
      lines.push(`- Memory budget: ${compat.memoryBudget.usedMB}/${compat.memoryBudget.budgetMB} MB`);
      lines.push('');
    }

    // Top recommendations
    const allRecs: Recommendation[] = [];
    if (data.performanceReport) allRecs.push(...data.performanceReport.recommendations);
    if (data.codeQualityReport) allRecs.push(...data.codeQualityReport.recommendations);

    if (allRecs.length > 0) {
      lines.push('## Top Recommendations');
      lines.push('');
      const topRecs = allRecs
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .slice(0, 5);

      for (const rec of topRecs) {
        lines.push(`### [${rec.priority.toUpperCase()}] ${rec.title}`);
        lines.push('');
        lines.push(rec.description);
        lines.push('');
        if (rec.steps.length > 0) {
          for (const step of rec.steps) {
            lines.push(`- ${step}`);
          }
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  // ─── Private Markdown formatters ───

  private formatAssetReportMarkdown(
    reportData: {
      title: string;
      timestamp: string;
      totalAssets: number;
      issuesSummary: { critical: number; warning: number; info: number };
      naniteCompatible: number;
      totalEstimatedMemoryMB: number;
    },
    analysis: AssetAnalysisResult[]
  ): string {
    const lines: string[] = [];
    lines.push(`# ${reportData.title}`);
    lines.push('');
    lines.push(`Generated: ${reportData.timestamp}`);
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Total Assets | ${reportData.totalAssets} |`);
    lines.push(`| Critical Issues | ${reportData.issuesSummary.critical} |`);
    lines.push(`| Warnings | ${reportData.issuesSummary.warning} |`);
    lines.push(`| Info | ${reportData.issuesSummary.info} |`);
    lines.push(`| Nanite Compatible | ${reportData.naniteCompatible} |`);
    lines.push(`| Estimated Memory | ${reportData.totalEstimatedMemoryMB.toFixed(1)} MB |`);
    lines.push('');

    if (analysis.length > 0) {
      lines.push('## Assets');
      lines.push('');
      lines.push('| Path | Type | Issues | Nanite | Memory (MB) |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const asset of analysis) {
        lines.push(
          `| ${asset.assetPath} | ${asset.assetType} | ${asset.detectedIssues.length} | ${asset.naniteCompatible ? 'Yes' : 'No'} | ${asset.estimatedMemory} |`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatPerformanceReportMarkdown(report: PerformanceReport): string {
    const lines: string[] = [];
    lines.push('# Performance Report');
    lines.push('');
    lines.push(`Generated: ${report.timestamp}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Overall Score | ${report.summary.overallScore}/100 |`);
    lines.push(`| Critical Issues | ${report.summary.criticalIssues} |`);
    lines.push(`| Warnings | ${report.summary.warnings} |`);
    lines.push(`| Estimated FPS (Low) | ${report.summary.estimatedFps.low} |`);
    lines.push(`| Estimated FPS (Mid) | ${report.summary.estimatedFps.mid} |`);
    lines.push(`| Estimated FPS (High) | ${report.summary.estimatedFps.high} |`);
    lines.push('');

    // Draw Calls
    lines.push('## Draw Call Analysis');
    lines.push('');
    lines.push(`| Category | Count |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Total | ${report.drawCallAnalysis.totalDrawCalls} |`);
    lines.push(`| Static Mesh | ${report.drawCallAnalysis.staticMeshDrawCalls} |`);
    lines.push(`| Skeletal Mesh | ${report.drawCallAnalysis.skeletalMeshDrawCalls} |`);
    lines.push(`| Particle | ${report.drawCallAnalysis.particleDrawCalls} |`);
    lines.push(`| UI | ${report.drawCallAnalysis.uiDrawCalls} |`);
    lines.push('');

    // Memory
    lines.push('## Memory Analysis');
    lines.push('');
    lines.push(`| Category | MB |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Total | ${report.memoryAnalysis.totalMemoryMB} |`);
    lines.push(`| Texture | ${report.memoryAnalysis.textureMemoryMB} |`);
    lines.push(`| Mesh | ${report.memoryAnalysis.meshMemoryMB} |`);
    lines.push(`| Audio | ${report.memoryAnalysis.audioMemoryMB} |`);
    lines.push(`| Script | ${report.memoryAnalysis.scriptMemoryMB} |`);
    lines.push('');

    // GPU
    lines.push('## GPU Analysis');
    lines.push('');
    lines.push(`- GPU Time: ${report.gpuAnalysis.gpuTimeMs.toFixed(2)} ms`);
    lines.push(`- Shader Complexity: ${report.gpuAnalysis.shaderComplexity}`);
    lines.push(`- Overdraw Ratio: ${report.gpuAnalysis.overdrawRatio.toFixed(2)}`);
    lines.push('');

    // Anti-patterns
    if (report.antiPatterns.length > 0) {
      lines.push('## Anti-Patterns');
      lines.push('');
      for (const ap of report.antiPatterns) {
        lines.push(`### [${ap.severity.toUpperCase()}] ${ap.description}`);
        lines.push('');
        lines.push(`- Category: ${ap.category}`);
        lines.push(`- Fix: ${ap.fix}`);
        lines.push(`- Estimated Improvement: ${ap.estimatedImprovement}`);
        if (ap.affectedAssets.length > 0) {
          lines.push(`- Affected Assets: ${ap.affectedAssets.join(', ')}`);
        }
        lines.push('');
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      this.appendRecommendations(lines, report.recommendations);
    }

    return lines.join('\n');
  }

  private formatCodeQualityReportMarkdown(report: CodeQualityReport): string {
    const lines: string[] = [];
    lines.push('# Code Quality Report');
    lines.push('');
    lines.push(`Generated: ${report.timestamp}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Overall Score | ${report.summary.overallScore}/100 |`);
    lines.push(`| Total Issues | ${report.summary.totalIssues} |`);
    lines.push(`| Critical | ${report.summary.criticalIssues} |`);
    lines.push(`| Warnings | ${report.summary.warnings} |`);
    lines.push(`| Suggestions | ${report.summary.suggestions} |`);
    lines.push('');

    // Naming violations
    if (report.namingViolations.length > 0) {
      lines.push('## Naming Violations');
      lines.push('');
      lines.push('| Asset | Current Name | Expected Pattern | Suggested Name |');
      lines.push('| --- | --- | --- | --- |');
      for (const v of report.namingViolations) {
        lines.push(`| ${v.assetPath} | ${v.currentName} | ${v.expectedPattern} | ${v.suggestedName} |`);
      }
      lines.push('');
    }

    // Circular dependencies
    if (report.circularDependencies.length > 0) {
      lines.push('## Circular Dependencies');
      lines.push('');
      for (const cd of report.circularDependencies) {
        lines.push(`- [${cd.severity.toUpperCase()}] ${cd.chain.join(' → ')}`);
        lines.push(`  - Fix: ${cd.suggestedFix}`);
      }
      lines.push('');
    }

    // Blueprint/C++ balance
    lines.push('## Blueprint/C++ Balance');
    lines.push('');
    lines.push(`- Blueprint: ${report.blueprintCppBalance.blueprintPercentage}%`);
    lines.push(`- C++: ${report.blueprintCppBalance.cppPercentage}%`);
    lines.push('');

    // Architecture issues
    if (report.architectureIssues.length > 0) {
      lines.push('## Architecture Issues');
      lines.push('');
      for (const issue of report.architectureIssues) {
        lines.push(`### [${issue.severity.toUpperCase()}] ${issue.description}`);
        lines.push('');
        lines.push(`- Category: ${issue.category}`);
        lines.push(`- Suggested Refactoring: ${issue.suggestedRefactoring}`);
        if (issue.affectedFiles.length > 0) {
          lines.push(`- Affected Files: ${issue.affectedFiles.join(', ')}`);
        }
        lines.push('');
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      this.appendRecommendations(lines, report.recommendations);
    }

    return lines.join('\n');
  }

  private formatCompatibilityReportMarkdown(report: CompatibilityReport): string {
    const lines: string[] = [];
    lines.push('# Compatibility Report');
    lines.push('');
    lines.push(`Target Platform: ${report.targetPlatform}`);
    lines.push('');

    // Build status
    lines.push('## Build Status');
    lines.push('');
    lines.push(`- Can Build: ${report.canBuild ? '✅ Yes' : '❌ No'}`);
    lines.push(`- Total Issues: ${report.issues.length}`);
    lines.push(`- Blocking Issues: ${report.blockingIssues.length}`);
    lines.push('');

    // Shader compatibility
    lines.push('## Shader Compatibility');
    lines.push('');
    lines.push(`- Feature Level: ${report.shaderCompatibility.featureLevel}`);
    lines.push(`- Shader Model: ${report.shaderCompatibility.shaderModel}`);
    lines.push(`- Compatible: ${report.shaderCompatibility.compatible ? 'Yes' : 'No'}`);
    if (report.shaderCompatibility.incompatibleShaders.length > 0) {
      lines.push(`- Incompatible Shaders: ${report.shaderCompatibility.incompatibleShaders.join(', ')}`);
    }
    lines.push('');

    // Memory budget
    lines.push('## Memory Budget');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Budget | ${report.memoryBudget.budgetMB} MB |`);
    lines.push(`| Used | ${report.memoryBudget.usedMB} MB |`);
    lines.push(`| Remaining | ${report.memoryBudget.remainingMB} MB |`);
    lines.push(`| Over Budget | ${report.memoryBudget.overBudget ? 'Yes' : 'No'} |`);
    lines.push('');

    // Issues
    if (report.issues.length > 0) {
      lines.push('## Issues');
      lines.push('');
      lines.push('| Severity | Category | Description | Fix |');
      lines.push('| --- | --- | --- | --- |');
      for (const issue of report.issues) {
        lines.push(`| ${issue.severity} | ${issue.category} | ${issue.description} | ${issue.fix} |`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private appendRecommendations(lines: string[], recommendations: Recommendation[]): void {
    for (const rec of recommendations) {
      lines.push(`### [${rec.priority.toUpperCase()}] ${rec.title}`);
      lines.push('');
      lines.push(rec.description);
      lines.push('');
      if (rec.steps.length > 0) {
        for (const step of rec.steps) {
          lines.push(`- ${step}`);
        }
        lines.push('');
      }
      lines.push(`Estimated Impact: ${rec.estimatedImpact}`);
      lines.push('');
    }
  }
}
