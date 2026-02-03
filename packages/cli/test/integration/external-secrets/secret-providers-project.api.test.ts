import { LicenseState } from '@n8n/backend-common';
import { createTeamProject, mockInstance, testDb } from '@n8n/backend-test-utils';
import type { Project } from '@n8n/db';
import {
	ProjectSecretsProviderAccessRepository,
	SecretsProviderConnectionRepository,
} from '@n8n/db';
import { Container } from '@n8n/di';
import { mock } from 'jest-mock-extended';

import { ExternalSecretsConfig } from '@/modules/external-secrets.ee/external-secrets.config';
import { ExternalSecretsProviders } from '@/modules/external-secrets.ee/external-secrets-providers.ee';

import { MockProviders } from '../../shared/external-secrets/utils';
import { createAdmin, createMember, createOwner } from '../shared/db/users';
import type { SuperAgentTest } from '../shared/types';
import * as utils from '../shared/utils';

const mockProvidersInstance = new MockProviders();
mockInstance(ExternalSecretsProviders, mockProvidersInstance);

const licenseMock = mock<LicenseState>();
licenseMock.isLicensed.mockReturnValue(true);
Container.set(LicenseState, licenseMock);

mockInstance(ExternalSecretsConfig, {
	externalSecretsForProjects: true,
});

describe('Secret Providers Project API', () => {
	const testServer = utils.setupTestServer({
		endpointGroups: ['externalSecrets'],
		enabledFeatures: ['feat:externalSecrets'],
		modules: ['external-secrets'],
	});

	let ownerAgent: SuperAgentTest;
	let adminAgent: SuperAgentTest;
	let memberAgent: SuperAgentTest;
	let teamProject1: Project;
	let teamProject2: Project;
	let connectionRepository: SecretsProviderConnectionRepository;
	let projectAccessRepository: ProjectSecretsProviderAccessRepository;

	beforeAll(async () => {
		const [owner, admin, member] = await Promise.all([
			createOwner(),
			createAdmin(),
			createMember(),
		]);
		ownerAgent = testServer.authAgentFor(owner);
		adminAgent = testServer.authAgentFor(admin);
		memberAgent = testServer.authAgentFor(member);

		teamProject1 = await createTeamProject('Engineering');
		teamProject2 = await createTeamProject('Marketing');

		connectionRepository = Container.get(SecretsProviderConnectionRepository);
		projectAccessRepository = Container.get(ProjectSecretsProviderAccessRepository);
	});

	beforeEach(async () => {
		await testDb.truncate(['SecretsProviderConnection', 'ProjectSecretsProviderAccess']);
	});

	async function createConnection(providerKey: string, projectIds: string[] = []): Promise<number> {
		const connection = await connectionRepository.save(
			connectionRepository.create({
				providerKey,
				type: 'awsSecretsManager',
				encryptedSettings: JSON.stringify({ mocked: 'encrypted' }),
				isEnabled: true,
			}),
		);

		if (projectIds.length > 0) {
			const entries = projectIds.map((projectId) =>
				projectAccessRepository.create({
					secretsProviderConnectionId: connection.id,
					projectId,
				}),
			);
			await projectAccessRepository.save(entries);
		}

		return connection.id;
	}

	describe('GET /secret-providers/projects/:projectId/connections', () => {
		describe('Authorization', () => {
			beforeEach(async () => {
				await createConnection('test-connection', [teamProject1.id]);
			});

			test('should allow owner to list connections for any project', async () => {
				const response = await ownerAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(Array.isArray(response.body.data)).toBe(true);
			});

			test('should allow admin to list connections for any project', async () => {
				const response = await adminAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(Array.isArray(response.body.data)).toBe(true);
			});

			test('should deny member from listing connections', async () => {
				const response = await memberAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(403);

				expect(response.body.message).toBe(
					'User is missing a scope required to perform this action',
				);
			});
		});

		describe('Functionality', () => {
			test('should return project-specific connections', async () => {
				await createConnection('project1-connection', [teamProject1.id]);

				const response = await ownerAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(response.body.data).toHaveLength(1);
				expect(response.body.data[0].name).toBe('project1-connection');
			});

			test('should return global connections (no project assignment)', async () => {
				// Create a global connection (no projectIds)
				await createConnection('global-connection', []);

				const response = await ownerAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(response.body.data).toHaveLength(1);
				expect(response.body.data[0].name).toBe('global-connection');
			});

			test('should return combined list (project + global)', async () => {
				// Create project-specific connection
				await createConnection('project1-connection', [teamProject1.id]);
				// Create global connection
				await createConnection('global-connection', []);

				const response = await ownerAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(response.body.data).toHaveLength(2);
				const names = response.body.data.map((c: { name: string }) => c.name);
				expect(names).toContain('project1-connection');
				expect(names).toContain('global-connection');
			});

			test('should NOT return connections assigned to other projects', async () => {
				// Create connection for project2 only
				await createConnection('project2-only-connection', [teamProject2.id]);

				const response = await ownerAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(response.body.data).toHaveLength(0);
			});

			test('should return correct mix when multiple connections exist', async () => {
				// Global connection
				await createConnection('global-connection', []);
				// Project1-specific connection
				await createConnection('project1-connection', [teamProject1.id]);
				// Project2-specific connection (should NOT appear)
				await createConnection('project2-connection', [teamProject2.id]);
				// Shared connection for both projects
				await createConnection('shared-connection', [teamProject1.id, teamProject2.id]);

				const response = await ownerAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(response.body.data).toHaveLength(3);
				const names = response.body.data.map((c: { name: string }) => c.name);
				expect(names).toContain('global-connection');
				expect(names).toContain('project1-connection');
				expect(names).toContain('shared-connection');
				expect(names).not.toContain('project2-connection');
			});

			test('should return empty array when no connections exist', async () => {
				const response = await ownerAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(response.body.data).toEqual([]);
			});

			test('should return connection details in correct format', async () => {
				await createConnection('format-test-connection', [teamProject1.id]);

				const response = await ownerAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(response.body.data[0]).toMatchObject({
					id: expect.any(String),
					name: 'format-test-connection',
					type: 'awsSecretsManager',
					isEnabled: true,
					projects: expect.any(Array),
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				});
			});

			test('should not expose settings in response', async () => {
				await createConnection('security-test', [teamProject1.id]);

				const response = await ownerAgent
					.get(`/secret-providers/projects/${teamProject1.id}/connections`)
					.expect(200);

				expect(response.body.data[0]).not.toHaveProperty('settings');
				expect(response.body.data[0]).not.toHaveProperty('encryptedSettings');
			});
		});
	});
});
