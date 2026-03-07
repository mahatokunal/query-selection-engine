"use client";

import { useState } from "react";
import {
  StructuredQuery,
  MODALITY_OPTIONS,
  STAGE_OPTIONS,
  GEOGRAPHY_OPTIONS,
  MECHANISM_OPTIONS,
  ASSET_TYPE_OPTIONS,
} from "@/lib/types";

interface ParsedQueryFormProps {
  structuredQuery: StructuredQuery;
  warnings: string[];
  poolSize: number;
  onUpdate: (sq: StructuredQuery) => void;
  onPoolSizeChange: (size: number) => void;
  onGenerate: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export default function ParsedQueryForm({
  structuredQuery,
  warnings,
  poolSize,
  onUpdate,
  onPoolSizeChange,
  onGenerate,
  onBack,
  isLoading,
}: ParsedQueryFormProps) {
  const [otherModality, setOtherModality] = useState("");
  const [otherGeography, setOtherGeography] = useState("");
  const [otherMechanism, setOtherMechanism] = useState("");
  const [attempted, setAttempted] = useState(false);

  const sq = structuredQuery;

  const isValid = sq.target.trim() !== "" && sq.modality.length > 0 && sq.indication.trim() !== "";

  const update = (partial: Partial<StructuredQuery>) => {
    onUpdate({ ...sq, ...partial });
  };

  const toggleInList = (list: string[], item: string): string[] => {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  };

  const handleGenerate = () => {
    setAttempted(true);
    if (!isValid) return;

    // Append "Other" entries if filled
    let finalSq = { ...sq };
    if (otherModality.trim()) {
      const other = `Other: ${otherModality.trim()}`;
      if (!finalSq.modality.includes(other)) {
        finalSq = { ...finalSq, modality: [...finalSq.modality, other] };
      }
    }
    if (otherGeography.trim()) {
      const other = `Other: ${otherGeography.trim()}`;
      if (!finalSq.geography.includes(other)) {
        finalSq = { ...finalSq, geography: [...finalSq.geography, other] };
      }
    }
    if (otherMechanism.trim()) {
      if (!finalSq.mechanism.includes(otherMechanism.trim())) {
        finalSq = { ...finalSq, mechanism: [...finalSq.mechanism, otherMechanism.trim()] };
      }
    }
    onUpdate(finalSq);
    onGenerate();
  };

  const inputClass = (valid: boolean) =>
    `w-full bg-[#0a0a0a] border rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none transition-colors ${
      !valid && attempted
        ? "border-red-500 focus:border-red-400"
        : "border-[#2a2a2a] focus:border-[#00c277]"
    }`;

  const checkboxClass = (checked: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
      checked
        ? "bg-[#00c277]/20 border-[#00c277] text-[#00c277]"
        : "bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:border-[#444] hover:text-white"
    }`;

  const radioClass = (checked: boolean) =>
    `px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
      checked
        ? "bg-[#00c277]/20 border-[#00c277] text-[#00c277]"
        : "bg-[#0a0a0a] border-[#2a2a2a] text-[#888] hover:border-[#444] hover:text-white"
    }`;

  return (
    <div className="glass-card rounded-xl p-5 space-y-5">
      <h2 className="text-sm font-medium text-[#888] uppercase tracking-wider">
        Parsed Query — Review & Edit
      </h2>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-600/40 bg-yellow-900/20 px-4 py-3">
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-400">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Target */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">
          Target <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={sq.target}
          onChange={(e) => update({ target: e.target.value })}
          placeholder="e.g. CDK12, MDM2 & MDM4"
          className={inputClass(sq.target.trim() !== "")}
        />
      </div>

      {/* Modality */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">
          Modality <span className="text-red-400">*</span>
          {attempted && sq.modality.length === 0 && (
            <span className="text-red-400 ml-2">Select at least one</span>
          )}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {MODALITY_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update({ modality: toggleInList(sq.modality, m) })}
              className={checkboxClass(sq.modality.includes(m))}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={otherModality}
          onChange={(e) => setOtherModality(e.target.value)}
          placeholder="Other modality..."
          className="mt-2 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#00c277] transition-colors"
        />
      </div>

      {/* Stage Range */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Stage Range</label>
        <div className="flex gap-3">
          <select
            value={sq.stage_from || ""}
            onChange={(e) => update({ stage_from: e.target.value || null })}
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00c277]"
          >
            <option value="">From (any)</option>
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={sq.stage_to || ""}
            onChange={(e) => update({ stage_to: e.target.value || null })}
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00c277]"
          >
            <option value="">To (any)</option>
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Indication */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">
          Indication <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={sq.indication}
          onChange={(e) => update({ indication: e.target.value })}
          placeholder="e.g. Triple Negative Breast Cancer"
          className={inputClass(sq.indication.trim() !== "")}
        />
      </div>

      {/* Geography */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Geography</label>
        <div className="flex flex-wrap gap-2">
          {GEOGRAPHY_OPTIONS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => update({ geography: toggleInList(sq.geography, g) })}
              className={checkboxClass(sq.geography.includes(g))}
            >
              {g}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={otherGeography}
          onChange={(e) => setOtherGeography(e.target.value)}
          placeholder="Other geography..."
          className="mt-2 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#00c277] transition-colors"
        />
      </div>

      {/* Mechanism */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Mechanism</label>
        <div className="grid grid-cols-2 gap-2">
          {MECHANISM_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update({ mechanism: toggleInList(sq.mechanism, m) })}
              className={checkboxClass(sq.mechanism.includes(m))}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={otherMechanism}
          onChange={(e) => setOtherMechanism(e.target.value)}
          placeholder="Other mechanism..."
          className="mt-2 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#00c277] transition-colors"
        />
      </div>

      {/* Development Status */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Development Status</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update({ development_status: "active_only" })}
            className={radioClass(sq.development_status === "active_only")}
          >
            Active only
          </button>
          <button
            type="button"
            onClick={() => update({ development_status: "include_discontinued" })}
            className={radioClass(sq.development_status === "include_discontinued")}
          >
            Include discontinued
          </button>
        </div>
      </div>

      {/* Asset Type */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Asset Type</label>
        <div className="flex flex-wrap gap-2">
          {ASSET_TYPE_OPTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => update({ asset_type: toggleInList(sq.asset_type, a) })}
              className={checkboxClass(sq.asset_type.includes(a))}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Scope */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Asset Scope</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update({ asset_scope: "lead_per_program" })}
            className={radioClass(sq.asset_scope === "lead_per_program")}
          >
            Lead per program
          </button>
          <button
            type="button"
            onClick={() => update({ asset_scope: "all_per_program" })}
            className={radioClass(sq.asset_scope === "all_per_program")}
          >
            All per program
          </button>
        </div>
      </div>

      {/* Other Constraints */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Other Constraints</label>
        <textarea
          value={sq.other_constraints}
          onChange={(e) => update({ other_constraints: e.target.value })}
          placeholder="Any additional constraints..."
          rows={2}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#00c277] transition-colors resize-none"
        />
      </div>

      {/* Pool Size */}
      <div>
        <label className="block text-xs text-[#888] mb-1.5">Pool Size</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={20}
            max={5000}
            step={10}
            value={poolSize}
            onChange={(e) => onPoolSizeChange(Number(e.target.value))}
            className="flex-1 accent-[#00c277]"
          />
          <input
            type="number"
            min={20}
            max={5000}
            step={10}
            value={poolSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 20 && v <= 5000) onPoolSizeChange(v);
            }}
            className="w-16 bg-[#0a0a0a] border border-[#2a2a2a] rounded px-2 py-1 text-sm text-white text-center font-mono focus:outline-none focus:border-[#00c277]"
          />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="px-5 py-2.5 border border-[#2a2a2a] text-[#888] font-medium text-sm rounded-lg hover:border-[#444] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Back
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isLoading}
          className="px-5 py-2.5 bg-[#00c277] text-[#0a0a0a] font-semibold text-sm rounded-lg hover:bg-[#00ff99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Generating..." : "Generate Queries"}
        </button>
      </div>
    </div>
  );
}
