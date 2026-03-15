import { useState } from 'react';
import { RefreshCw, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { temporalKnowledgeBase, TemporalConcept } from '../lib/temporalValidation';

export default function TemporalKnowledgeManager() {
  const [concepts, setConcepts] = useState<TemporalConcept[]>(temporalKnowledgeBase);
  const [isEditing, setIsEditing] = useState(false);
  const [newConcept, setNewConcept] = useState<Partial<TemporalConcept>>({
    concept: '',
    validFrom: '',
    category: 'orgao',
    description: '',
    currentStatus: 'ativo'
  });

  const handleAddConcept = () => {
    if (!newConcept.concept || !newConcept.validFrom || !newConcept.description) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    const concept: TemporalConcept = {
      concept: newConcept.concept!,
      validFrom: newConcept.validFrom!,
      category: newConcept.category as TemporalConcept['category'],
      description: newConcept.description!,
      currentStatus: newConcept.currentStatus as TemporalConcept['currentStatus'],
      validTo: newConcept.validTo,
      replacedBy: newConcept.replacedBy
    };

    setConcepts([...concepts, concept]);
    setNewConcept({
      concept: '',
      validFrom: '',
      category: 'orgao',
      description: '',
      currentStatus: 'ativo'
    });
  };

  const handleDeleteConcept = (index: number) => {
    setConcepts(concepts.filter((_, i) => i !== index));
  };

  const exportKnowledgeBase = () => {
    const dataStr = JSON.stringify(concepts, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `temporal-knowledge-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importKnowledgeBase = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setConcepts(imported);
        alert('Base de conhecimento importada com sucesso!');
      } catch (error) {
        alert('Erro ao importar arquivo. Verifique o formato JSON.');
      }
    };
    reader.readAsText(file);
  };

  const getStatusIcon = (status: TemporalConcept['currentStatus']) => {
    switch (status) {
      case 'ativo':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'substituido':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'revogado':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getCategoryColor = (category: TemporalConcept['category']) => {
    switch (category) {
      case 'orgao':
        return 'bg-blue-100 text-blue-700';
      case 'lei':
        return 'bg-purple-100 text-purple-700';
      case 'regulamento':
        return 'bg-green-100 text-green-700';
      case 'processo':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Base de Conhecimento Temporal</h3>
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Validação de Conceitos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
            title={isEditing ? "Cancelar edição" : "Editar base"}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={exportKnowledgeBase}
            className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
            title="Exportar base"
          >
            <Database className="w-5 h-5" />
          </button>
          <label className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors cursor-pointer" title="Importar base">
            <input
              type="file"
              accept=".json"
              onChange={importKnowledgeBase}
              className="hidden"
            />
            <Database className="w-5 h-5" />
          </label>
        </div>
      </div>

      {isEditing && (
        <div className="mb-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
          <h4 className="text-sm font-black text-indigo-800 mb-4">Adicionar Novo Conceito</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nome do conceito"
              value={newConcept.concept}
              onChange={(e) => setNewConcept({...newConcept, concept: e.target.value})}
              className="px-4 py-2 rounded-xl border border-indigo-200 text-sm font-medium"
            />
            <input
              type="date"
              value={newConcept.validFrom}
              onChange={(e) => setNewConcept({...newConcept, validFrom: e.target.value})}
              className="px-4 py-2 rounded-xl border border-indigo-200 text-sm font-medium"
            />
            <select
              value={newConcept.category}
              onChange={(e) => setNewConcept({...newConcept, category: e.target.value as TemporalConcept['category']})}
              className="px-4 py-2 rounded-xl border border-indigo-200 text-sm font-medium"
            >
              <option value="orgao">Órgão</option>
              <option value="lei">Lei</option>
              <option value="regulamento">Regulamento</option>
              <option value="processo">Processo</option>
              <option value="outro">Outro</option>
            </select>
            <select
              value={newConcept.currentStatus}
              onChange={(e) => setNewConcept({...newConcept, currentStatus: e.target.value as TemporalConcept['currentStatus']})}
              className="px-4 py-2 rounded-xl border border-indigo-200 text-sm font-medium"
            >
              <option value="ativo">Ativo</option>
              <option value="substituido">Substituído</option>
              <option value="revogado">Revogado</option>
              <option value="desatualizado">Desatualizado</option>
            </select>
            <input
              type="text"
              placeholder="Substituído por (opcional)"
              value={newConcept.replacedBy || ''}
              onChange={(e) => setNewConcept({...newConcept, replacedBy: e.target.value})}
              className="px-4 py-2 rounded-xl border border-indigo-200 text-sm font-medium"
            />
            <input
              type="date"
              value={newConcept.validTo || ''}
              onChange={(e) => setNewConcept({...newConcept, validTo: e.target.value})}
              className="px-4 py-2 rounded-xl border border-indigo-200 text-sm font-medium"
            />
          </div>
          <textarea
            placeholder="Descrição do conceito"
            value={newConcept.description}
            onChange={(e) => setNewConcept({...newConcept, description: e.target.value})}
            className="w-full mt-4 px-4 py-2 rounded-xl border border-indigo-200 text-sm font-medium resize-none"
            rows={3}
          />
          <button
            onClick={handleAddConcept}
            className="mt-4 px-6 py-2 bg-indigo-600 text-white text-sm font-black rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Adicionar Conceito
          </button>
        </div>
      )}

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {concepts.map((concept, index) => (
          <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors group">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {getStatusIcon(concept.currentStatus)}
                <span className="font-black text-slate-900">{concept.concept}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getCategoryColor(concept.category)}`}>
                  {concept.category}
                </span>
              </div>
              <p className="text-sm text-slate-600 mb-2">{concept.description}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>Válido de: {concept.validFrom}</span>
                {concept.validTo && <span>até: {concept.validTo}</span>}
                {concept.replacedBy && <span>Substituído por: {concept.replacedBy}</span>}
              </div>
            </div>
            {isEditing && (
              <button
                onClick={() => handleDeleteConcept(index)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                <AlertTriangle className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
