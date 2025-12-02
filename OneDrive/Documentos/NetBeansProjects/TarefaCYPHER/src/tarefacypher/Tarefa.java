/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package tarefacypher;

/**
 *
 * @author Caua0
 */
public class Tarefa {
   


    private int idTarefa;
    private int fkProjeto;
    private String nomeTarefa;
    private String dataLimite;
    private String status;
    private int complexidade;
    private Integer tempoEstimado;
    private Integer tempoRealGasto;

    public Tarefa() {}

    public Tarefa(int idTarefa, int fkProjeto, String nomeTarefa, String dataLimite,
                  String status, int complexidade, Integer tempoEstimado, Integer tempoRealGasto) {
        this.idTarefa = idTarefa;
        this.fkProjeto = fkProjeto;
        this.nomeTarefa = nomeTarefa;
        this.dataLimite = dataLimite;
        this.status = status;
        this.complexidade = complexidade;
        this.tempoEstimado = tempoEstimado;
        this.tempoRealGasto = tempoRealGasto;
    }

    public int getIdTarefa() {
        return idTarefa;
    }

    public void setIdTarefa(int idTarefa) {
        this.idTarefa = idTarefa;
    }

    public int getFkProjeto() {
        return fkProjeto;
    }

    public void setFkProjeto(int fkProjeto) {
        this.fkProjeto = fkProjeto;
    }

    public String getNomeTarefa() {
        return nomeTarefa;
    }

    public void setNomeTarefa(String nomeTarefa) {
        this.nomeTarefa = nomeTarefa;
    }

    public String getDataLimite() {
        return dataLimite;
    }

    public void setDataLimite(String dataLimite) {
        this.dataLimite = dataLimite;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public int getComplexidade() {
        return complexidade;
    }

    public void setComplexidade(int complexidade) {
        this.complexidade = complexidade;
    }

    public Integer getTempoEstimado() {
        return tempoEstimado;
    }

    public void setTempoEstimado(Integer tempoEstimado) {
        this.tempoEstimado = tempoEstimado;
    }

    public Integer getTempoRealGasto() {
        return tempoRealGasto;
    }

    public void setTempoRealGasto(Integer tempoRealGasto) {
        this.tempoRealGasto = tempoRealGasto;
    }

    @Override
    public String toString() {
        return "Tarefa{" +
                "idTarefa=" + idTarefa +
                ", fkProjeto=" + fkProjeto +
                ", nomeTarefa='" + nomeTarefa + '\'' +
                ", dataLimite='" + dataLimite + '\'' +
                ", status='" + status + '\'' +
                ", complexidade=" + complexidade +
                ", tempoEstimado=" + tempoEstimado +
                ", tempoRealGasto=" + tempoRealGasto +
                '}';
    }
}

