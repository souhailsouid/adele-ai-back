/**
 * Lecture directe depuis S3 pour les petites requêtes (lookups par ID)
 * 
 * ⚠️ INTERDIT EN PRODUCTION - SÉCURITÉ COÛT
 * 
 * Cette fonction génère des centaines de milliers de requêtes S3 GET (coût élevé).
 * Utiliser Athena avec cache Lambda à la place pour les APIs.
 * 
 * Cette fonction est conservée uniquement pour:
 * - Tests locaux (scripts de développement)
 * - Migration de données (one-shot)
 * 
 * ⚠️ NE PAS utiliser dans le code de production (APIs, Lambdas, CRONs)
 */

// 🔒 BARRIÈRE SÉCURITÉ: Throw en production pour éviter les coûts catastrophiques
if (process.env.NODE_ENV === 'production' || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  throw new Error(
    's3-direct-read is DISABLED in production (cost safety). ' +
    'Use Athena with Lambda cache instead. ' +
    'This function generated 43M+ S3 GET requests ($18/day).'
  );
}

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as parquetjs from 'parquetjs';
const { ParquetReader } = parquetjs;
import * as stream from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';

/**
 * Convertir un stream en buffer
 */
function streamToBuffer(stream: stream.Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Lire un fichier Parquet depuis S3 et chercher une ligne par ID
 * 
 * Note: Cette fonction scanne un fichier Parquet. Pour les très gros fichiers,
 * il vaut mieux utiliser Athena. Mais pour les petits fichiers (< 10MB) ou
 * les tables peu volumineuses, c'est plus économique.
 */
export async function findRowByIdInS3Parquet<T>(
  tableName: string,
  id: number,
  idColumn: string = 'id'
): Promise<T | null> {
  // Lister les fichiers Parquet pour cette table
  const prefix = `data/${tableName}/`;
  const files: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_DATA_LAKE_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    const objects = response.Contents || [];

    for (const obj of objects) {
      if (obj.Key && obj.Key.endsWith('.parquet')) {
        files.push(obj.Key);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  if (files.length === 0) {
    return null;
  }

  // Parcourir les fichiers jusqu'à trouver la ligne
  // On commence par les plus récents (derniers fichiers = nouvelles données)
  const sortedFiles = files.sort().reverse();

  for (const fileKey of sortedFiles) {
    try {
      // Télécharger le fichier Parquet
      const getCommand = new GetObjectCommand({
        Bucket: S3_DATA_LAKE_BUCKET,
        Key: fileKey,
      });

      const response = await s3Client.send(getCommand);
      if (!response.Body) {
        continue;
      }

      // Créer un fichier temporaire pour ParquetReader
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `parquet_${Date.now()}_${Math.random().toString(36).substring(7)}.parquet`);
      
      try {
        // Écrire le stream dans un fichier temporaire
        const buffer = await streamToBuffer(response.Body as stream.Readable);
        fs.writeFileSync(tempFilePath, buffer);

        // Lire le fichier Parquet
        const reader = await ParquetReader.openFile(tempFilePath);

        // Parcourir les lignes
        const cursor = reader.getCursor();
        let row: any;

        while ((row = await cursor.next())) {
          if (row[idColumn] === id) {
            await reader.close();
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
            return row as T;
          }
        }

        await reader.close();
        
        // Nettoyer le fichier temporaire
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (error: any) {
        // Nettoyer en cas d'erreur
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        // Si erreur sur un fichier, continuer avec le suivant
        console.error(`Error reading ${fileKey}:`, error.message);
        continue;
      }
    } catch (error: any) {
      // Erreur lors du téléchargement S3
      console.error(`Error downloading ${fileKey}:`, error.message);
      continue;
    }
  }

  return null;
}

/**
 * Lire un fichier Parquet depuis S3 et chercher une ligne par une colonne spécifique
 */
export async function findRowByColumnInS3Parquet<T>(
  tableName: string,
  column: string,
  value: string | number,
  partition?: { year: number; month: number }
): Promise<T | null> {
  // Construire le préfixe avec partition si fournie
  let prefix = `data/${tableName}/`;
  if (partition) {
    prefix += `year=${partition.year}/month=${partition.month}/`;
  }

  const files: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_DATA_LAKE_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    const objects = response.Contents || [];

    for (const obj of objects) {
      if (obj.Key && obj.Key.endsWith('.parquet')) {
        files.push(obj.Key);
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  if (files.length === 0) {
    return null;
  }

  // Parcourir les fichiers (du plus récent au plus ancien)
  const sortedFiles = files.sort().reverse();

  for (const fileKey of sortedFiles) {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: S3_DATA_LAKE_BUCKET,
        Key: fileKey,
      });

      const response = await s3Client.send(getCommand);
      if (!response.Body) {
        continue;
      }

      // Créer un fichier temporaire pour ParquetReader
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `parquet_${Date.now()}_${Math.random().toString(36).substring(7)}.parquet`);
      
      try {
        const buffer = await streamToBuffer(response.Body as stream.Readable);
        fs.writeFileSync(tempFilePath, buffer);

        const reader = await ParquetReader.openFile(tempFilePath);
        const cursor = reader.getCursor();
        let row: any;

        while ((row = await cursor.next())) {
          // Comparaison flexible (string/number)
          const rowValue = row[column];
          if (rowValue === value || String(rowValue) === String(value)) {
            await reader.close();
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
            return row as T;
          }
        }

        await reader.close();
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (error: any) {
        // Nettoyer en cas d'erreur
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        console.error(`Error reading ${fileKey}:`, error.message);
        continue;
      }
    } catch (error: any) {
      // Erreur lors du téléchargement S3
      console.error(`Error downloading ${fileKey}:`, error.message);
      continue;
    }
  }

  return null;
}
