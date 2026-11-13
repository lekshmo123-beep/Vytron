export interface SampleSbomPreset {
  id: string;
  label: string;
  fileName: string;
  format: 'CycloneDX JSON' | 'CycloneDX XML' | 'SPDX JSON' | 'SPDX Tag-Value';
  applicationName: string;
  description: string;
  content: string;
}

export const SAMPLE_SBOMS: SampleSbomPreset[] = [
  {
    id: 'cdx-json-node',
    label: 'Node.js Microservice (CycloneDX JSON)',
    fileName: 'payment-gateway-cdx.json',
    format: 'CycloneDX JSON',
    applicationName: 'payment-gateway-api',
    description:
      'Realistic npm service manifest containing Express, Lodash, Axios, Minimist, and Jsonwebtoken for live OSV.dev verification.',
    content: JSON.stringify(
      {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        serialNumber: 'urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79',
        version: 1,
        metadata: {
          timestamp: '2026-10-18T12:00:00Z',
          component: {
            'bom-ref': 'pkg:npm/payment-gateway-api@2.4.0',
            type: 'application',
            name: 'payment-gateway-api',
            version: '2.4.0',
            purl: 'pkg:npm/payment-gateway-api@2.4.0',
          },
        },
        components: [
          {
            'bom-ref': 'pkg:npm/express@4.18.2',
            type: 'library',
            name: 'express',
            version: '4.18.2',
            purl: 'pkg:npm/express@4.18.2',
            supplier: { name: 'OpenJS Foundation' },
            licenses: [{ license: { id: 'MIT' } }],
          },
          {
            'bom-ref': 'pkg:npm/lodash@4.17.20',
            type: 'library',
            name: 'lodash',
            version: '4.17.20',
            purl: 'pkg:npm/lodash@4.17.20',
            supplier: { name: 'OpenJS Foundation' },
            licenses: [{ license: { id: 'MIT' } }],
          },
          {
            'bom-ref': 'pkg:npm/axios@1.6.0',
            type: 'library',
            name: 'axios',
            version: '1.6.0',
            purl: 'pkg:npm/axios@1.6.0',
            supplier: { name: 'Matt Zabriskie' },
            licenses: [{ license: { id: 'MIT' } }],
          },
          {
            'bom-ref': 'pkg:npm/minimist@1.2.5',
            type: 'library',
            name: 'minimist',
            version: '1.2.5',
            purl: 'pkg:npm/minimist@1.2.5',
            supplier: { name: 'James Halliday' },
            licenses: [{ license: { id: 'MIT' } }],
          },
          {
            'bom-ref': 'pkg:npm/jsonwebtoken@8.5.1',
            type: 'library',
            name: 'jsonwebtoken',
            version: '8.5.1',
            purl: 'pkg:npm/jsonwebtoken@8.5.1',
            supplier: { name: 'Auth0' },
            licenses: [{ license: { id: 'MIT' } }],
          },
          {
            'bom-ref': 'pkg:npm/zod@3.23.8',
            type: 'library',
            name: 'zod',
            version: '3.23.8',
            purl: 'pkg:npm/zod@3.23.8',
            supplier: { name: 'Colin McDonnell' },
            licenses: [{ license: { id: 'MIT' } }],
          },
        ],
        dependencies: [
          {
            ref: 'pkg:npm/payment-gateway-api@2.4.0',
            dependsOn: [
              'pkg:npm/express@4.18.2',
              'pkg:npm/axios@1.6.0',
              'pkg:npm/jsonwebtoken@8.5.1',
              'pkg:npm/zod@3.23.8',
            ],
          },
          {
            ref: 'pkg:npm/express@4.18.2',
            dependsOn: ['pkg:npm/lodash@4.17.20'],
          },
          {
            ref: 'pkg:npm/jsonwebtoken@8.5.1',
            dependsOn: ['pkg:npm/lodash@4.17.20', 'pkg:npm/minimist@1.2.5'],
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'cdx-xml-java',
    label: 'Settlement Core (CycloneDX XML)',
    fileName: 'settlement-core-cdx.xml',
    format: 'CycloneDX XML',
    applicationName: 'settlement-core-service',
    description:
      'Maven Java service SBOM in CycloneDX 1.4 XML format including Log4j-core, Jackson-databind, and Spring-web.',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<bom xmlns="http://cyclonedx.org/schema/bom/1.4" version="1" serialNumber="urn:uuid:7c42b19a-12d1-4a34-89ef-001122334455">
  <metadata>
    <timestamp>2026-10-20T09:15:00Z</timestamp>
    <component type="application" bom-ref="pkg:maven/com.vytron.sample/settlement-core@3.1.0">
      <name>settlement-core-service</name>
      <version>3.1.0</version>
      <purl>pkg:maven/com.vytron.sample/settlement-core@3.1.0</purl>
    </component>
  </metadata>
  <components>
    <component type="library" bom-ref="pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1">
      <supplier><name>Apache Software Foundation</name></supplier>
      <name>org.apache.logging.log4j:log4j-core</name>
      <version>2.14.1</version>
      <licenses><license><id>Apache-2.0</id></license></licenses>
      <purl>pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1</purl>
    </component>
    <component type="library" bom-ref="pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.13.2">
      <supplier><name>FasterXML</name></supplier>
      <name>com.fasterxml.jackson.core:jackson-databind</name>
      <version>2.13.2</version>
      <licenses><license><id>Apache-2.0</id></license></licenses>
      <purl>pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.13.2</purl>
    </component>
    <component type="library" bom-ref="pkg:maven/org.springframework/spring-web@5.3.18">
      <supplier><name>VMware Tanzu</name></supplier>
      <name>org.springframework:spring-web</name>
      <version>5.3.18</version>
      <licenses><license><id>Apache-2.0</id></license></licenses>
      <purl>pkg:maven/org.springframework/spring-web@5.3.18</purl>
    </component>
    <component type="library" bom-ref="pkg:maven/org.slf4j/slf4j-api@2.0.12">
      <supplier><name>QOS.ch</name></supplier>
      <name>org.slf4j:slf4j-api</name>
      <version>2.0.12</version>
      <licenses><license><id>MIT</id></license></licenses>
      <purl>pkg:maven/org.slf4j/slf4j-api@2.0.12</purl>
    </component>
  </components>
  <dependencies>
    <dependency ref="pkg:maven/com.vytron.sample/settlement-core@3.1.0">
      <dependency ref="pkg:maven/org.springframework/spring-web@5.3.18"/>
      <dependency ref="pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.13.2"/>
    </dependency>
    <dependency ref="pkg:maven/org.springframework/spring-web@5.3.18">
      <dependency ref="pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1"/>
      <dependency ref="pkg:maven/org.slf4j/slf4j-api@2.0.12"/>
    </dependency>
  </dependencies>
</bom>`,
  },
  {
    id: 'spdx-json-python',
    label: 'ML Telemetry Worker (SPDX JSON)',
    fileName: 'telemetry-worker-spdx.json',
    format: 'SPDX JSON',
    applicationName: 'telemetry-worker',
    description:
      'Python PyPI package manifest in SPDX 2.3 JSON format including urllib3, requests, cryptography, and pydantic.',
    content: JSON.stringify(
      {
        spdxVersion: 'SPDX-2.3',
        dataLicense: 'CC0-1.0',
        SPDXID: 'SPDXRef-DOCUMENT',
        name: 'telemetry-worker-1.8.0',
        documentNamespace: 'https://vytron.io/spdx/telemetry-worker-1.8.0',
        creationInfo: {
          created: '2026-10-22T15:30:00Z',
          creators: ['Tool: vytron-sample-generator'],
        },
        packages: [
          {
            SPDXID: 'SPDXRef-RootApp',
            name: 'telemetry-worker',
            versionInfo: '1.8.0',
            supplier: 'Organization: Internal Platform',
            licenseConcluded: 'Apache-2.0',
            externalRefs: [
              {
                referenceCategory: 'PACKAGE-MANAGER',
                referenceType: 'purl',
                referenceLocator: 'pkg:pypi/telemetry-worker@1.8.0',
              },
            ],
          },
          {
            SPDXID: 'SPDXRef-urllib3',
            name: 'urllib3',
            versionInfo: '1.26.4',
            supplier: 'Person: Andrey Petrov',
            licenseConcluded: 'MIT',
            externalRefs: [
              {
                referenceCategory: 'PACKAGE-MANAGER',
                referenceType: 'purl',
                referenceLocator: 'pkg:pypi/urllib3@1.26.4',
              },
            ],
          },
          {
            SPDXID: 'SPDXRef-requests',
            name: 'requests',
            versionInfo: '2.28.1',
            supplier: 'Organization: Python Software Foundation',
            licenseConcluded: 'Apache-2.0',
            externalRefs: [
              {
                referenceCategory: 'PACKAGE-MANAGER',
                referenceType: 'purl',
                referenceLocator: 'pkg:pypi/requests@2.28.1',
              },
            ],
          },
          {
            SPDXID: 'SPDXRef-cryptography',
            name: 'cryptography',
            versionInfo: '39.0.1',
            supplier: 'Organization: Python Cryptographic Authority',
            licenseConcluded: 'Apache-2.0',
            externalRefs: [
              {
                referenceCategory: 'PACKAGE-MANAGER',
                referenceType: 'purl',
                referenceLocator: 'pkg:pypi/cryptography@39.0.1',
              },
            ],
          },
          {
            SPDXID: 'SPDXRef-pydantic',
            name: 'pydantic',
            versionInfo: '2.7.1',
            supplier: 'Person: Samuel Colvin',
            licenseConcluded: 'MIT',
            externalRefs: [
              {
                referenceCategory: 'PACKAGE-MANAGER',
                referenceType: 'purl',
                referenceLocator: 'pkg:pypi/pydantic@2.7.1',
              },
            ],
          },
        ],
        relationships: [
          {
            spdxElementId: 'SPDXRef-DOCUMENT',
            relationshipType: 'DESCRIBES',
            relatedSpdxElement: 'SPDXRef-RootApp',
          },
          {
            spdxElementId: 'SPDXRef-RootApp',
            relationshipType: 'DEPENDS_ON',
            relatedSpdxElement: 'SPDXRef-requests',
          },
          {
            spdxElementId: 'SPDXRef-RootApp',
            relationshipType: 'DEPENDS_ON',
            relatedSpdxElement: 'SPDXRef-cryptography',
          },
          {
            spdxElementId: 'SPDXRef-RootApp',
            relationshipType: 'DEPENDS_ON',
            relatedSpdxElement: 'SPDXRef-pydantic',
          },
          {
            spdxElementId: 'SPDXRef-requests',
            relationshipType: 'DEPENDS_ON',
            relatedSpdxElement: 'SPDXRef-urllib3',
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'spdx-tv-go',
    label: 'Edge Proxy Daemon (SPDX Tag-Value)',
    fileName: 'edge-proxy-spdx.spdx',
    format: 'SPDX Tag-Value',
    applicationName: 'edge-proxy-daemon',
    description:
      'Go ecosystem SBOM in SPDX 2.3 tag-value text format for testing tag-value ingestion.',
    content: `SPDXVersion: SPDX-2.3
DataLicense: CC0-1.0
SPDXID: SPDXRef-DOCUMENT
DocumentName: edge-proxy-daemon-1.4.2
DocumentNamespace: https://vytron.io/spdx/edge-proxy-daemon-1.4.2
Creator: Tool: syft-1.4.0
Created: 2026-10-25T10:00:00Z

PackageName: edge-proxy-daemon
SPDXID: SPDXRef-Package-edge-proxy
PackageVersion: 1.4.2
PackageSupplier: Organization: Platform Edge Team
PackageLicenseConcluded: Apache-2.0
ExternalRef: PACKAGE-MANAGER purl pkg:golang/github.com/vytron/edge-proxy@1.4.2

PackageName: golang.org/x/net
SPDXID: SPDXRef-Package-x-net
PackageVersion: v0.17.0
PackageSupplier: Organization: The Go Authors
PackageLicenseConcluded: BSD-3-Clause
ExternalRef: PACKAGE-MANAGER purl pkg:golang/golang.org/x/net@v0.17.0

PackageName: google.golang.org/grpc
SPDXID: SPDXRef-Package-grpc
PackageVersion: v1.56.2
PackageSupplier: Organization: Google LLC
PackageLicenseConcluded: Apache-2.0
ExternalRef: PACKAGE-MANAGER purl pkg:golang/google.golang.org/grpc@v1.56.2

PackageName: github.com/gin-gonic/gin
SPDXID: SPDXRef-Package-gin
PackageVersion: v1.9.1
PackageSupplier: Organization: Gin-Gonic
PackageLicenseConcluded: MIT
ExternalRef: PACKAGE-MANAGER purl pkg:golang/github.com/gin-gonic/gin@v1.9.1

Relationship: SPDXRef-DOCUMENT DESCRIBES SPDXRef-Package-edge-proxy
Relationship: SPDXRef-Package-edge-proxy DEPENDS_ON SPDXRef-Package-grpc
Relationship: SPDXRef-Package-edge-proxy DEPENDS_ON SPDXRef-Package-gin
Relationship: SPDXRef-Package-grpc DEPENDS_ON SPDXRef-Package-x-net
`,
  },
];
