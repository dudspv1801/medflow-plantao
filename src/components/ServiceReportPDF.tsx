import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  PDFDownloadLink,
} from '@react-pdf/renderer';

export interface AtendimentoData {
  clinicName?: string;
  professionalName?: string;
  patientName: string;
  patientAge?: string | number;
  patientId?: string;
  patientDocument?: string;
  notes: string;
  date?: string; // ISO string or any date-parsable value
}

export interface ServiceReportPDFProps {
  atendimentoData: AtendimentoData;
  auditHash: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  header: {
    marginBottom: 12,
    textAlign: 'center',
  },
  clinic: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  professional: {
    fontSize: 12,
    marginTop: 4,
  },
  section: {
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  patientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  patientField: {
    fontSize: 11,
  },
  notes: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    fontSize: 10,
    display: 'flex',
    flexDirection: 'column',
  },
  audit: {
    fontSize: 9,
    color: '#333',
  },
  date: {
    fontSize: 9,
    marginTop: 4,
  },
  signatureWrap: {
    marginTop: 18,
    alignItems: 'flex-start',
  },
  signatureLine: {
    marginTop: 8,
    width: '60%',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
  },
});

export const ServiceReportPDF: React.FC<ServiceReportPDFProps> = ({ atendimentoData, auditHash }) => {
  const formattedDate = atendimentoData.date
    ? new Date(atendimentoData.date).toLocaleString('pt-BR')
    : new Date().toLocaleString('pt-BR');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.clinic}>{atendimentoData.clinicName ?? 'Clínica / Serviço'}</Text>
          <Text style={styles.professional}>{atendimentoData.professionalName ?? ''}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados do Paciente</Text>
          <View style={styles.patientRow}>
            <Text style={styles.patientField}>Nome: {atendimentoData.patientName}</Text>
            <Text style={styles.patientField}>Idade: {atendimentoData.patientAge ?? '-'}</Text>
          </View>
          <View style={[styles.patientRow, { marginTop: 6 }]}
          >
            <Text style={styles.patientField}>ID: {atendimentoData.patientId ?? '-'}</Text>
            <Text style={styles.patientField}>Documento: {atendimentoData.patientDocument ?? '-'}</Text>
          </View>
        </View>

        <View style={[styles.section, { flex: 1 }]}>
          <Text style={styles.sectionTitle}>Atendimento / Observações Clínicas</Text>
          <Text style={styles.notes}>{atendimentoData.notes}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.audit}>Audit Hash: {auditHash}</Text>
          <Text style={styles.date}>Data: {formattedDate}</Text>
          <View style={styles.signatureWrap}>
            <Text>Assinatura:</Text>
            <View style={styles.signatureLine} />
          </View>
        </View>
      </Page>
    </Document>
  );
};

export const ServiceReportPDFDownload: React.FC<{
  atendimentoData: AtendimentoData;
  auditHash: string;
  fileName?: string;
}> = ({ atendimentoData, auditHash, fileName }) => {
  const safeName = (atendimentoData.patientName || 'report').replace(/\s+/g, '_');
  const finalName = fileName ?? `atendimento-${safeName}.pdf`;

  return (
    <PDFDownloadLink
      document={<ServiceReportPDF atendimentoData={atendimentoData} auditHash={auditHash} />}
      fileName={finalName}
    >
      {({ loading }) => (
        <button type="button">{loading ? 'Gerando PDF…' : 'Download PDF'}</button>
      )}
    </PDFDownloadLink>
  );
};

export default ServiceReportPDF;
