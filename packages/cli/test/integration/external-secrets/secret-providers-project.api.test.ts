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

	async function createProviderConnection(
		providerKey: string,
		projectIds: string[] = [],
	): Promise<number> {
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
				await createProviderConnection('global-connection', []);
				await createProviderConnection('test-connection', [teamProject1.id]);
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

		describe('with global connections only', () => {
			test.todo('should return global connections');
		});

		describe('with project-specific connections only', () => {
			beforeAll(() => {
				// TODO: create a project with connections
			});

			describe('when the project has no connections', () => {
				beforeAll(() => {
					// TODO: fetch connections for projects without connections
				});

				test.todo('should return an empty array');

				test.todo('should not return other project connections');
			});

			describe('when the project has connections', () => {
				beforeAll(() => {
					// fetch connections for projects with connections
				});

				test.todo('should return project-specific connections');

				test.todo('should not return other project connections');
			});
		});

		describe('with both global and project-specific connections', () => {
			beforeAll(() => {
				// TODO: create a global connection
				// TODO: create a project with connections
				// fetch connections for projects with connections
			});

			test.todo('should return both global and project-specific connections');

			test.todo('should not return other project connections');
		});

		describe('with no connections', () => {
			test.todo('should return an empty array');
		});
	});
});
