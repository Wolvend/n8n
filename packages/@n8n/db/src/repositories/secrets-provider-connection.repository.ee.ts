import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';

import { SecretsProviderConnection } from '../entities';

@Service()
export class SecretsProviderConnectionRepository extends Repository<SecretsProviderConnection> {
	constructor(dataSource: DataSource) {
		super(SecretsProviderConnection, dataSource.manager);
	}

	async findAll(): Promise<SecretsProviderConnection[]> {
		return await this.find();
	}

	/**
	 * Find all global connections (connections with no project access entries)
	 */
	async findGlobalConnections(): Promise<SecretsProviderConnection[]> {
		return await this.manager
			.createQueryBuilder(SecretsProviderConnection, 'connection')
			.leftJoinAndSelect('connection.projectAccess', 'access')
			.where('access.secretsProviderConnectionId IS NULL')
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getMany();
	}

	/**
	 * Find all enabled connections that have access to a specific project
	 */
	async findByProjectId(projectId: string): Promise<SecretsProviderConnection[]> {
		return await this.manager
			.createQueryBuilder(SecretsProviderConnection, 'connection')
			.innerJoin('connection.projectAccess', 'access')
			.where('access.projectId = :projectId', { projectId })
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getMany();
	}

	/**
	 * Find all connections accessible to a project:
	 * - Connections specifically assigned to this project
	 * - Global connections (those with no project assignments)
	 * Returns connections with full project access relations loaded.
	 */
	async findAllAccessibleByProject(projectId: string): Promise<SecretsProviderConnection[]> {
		// First, get connections assigned to this project
		const projectConnections = await this.createQueryBuilder('connection')
			.leftJoinAndSelect('connection.projectAccess', 'projectAccess')
			.leftJoinAndSelect('projectAccess.project', 'project')
			.innerJoin('connection.projectAccess', 'access')
			.where('access.projectId = :projectId', { projectId })
			.andWhere('connection.isEnabled = :isEnabled', { isEnabled: true })
			.getMany();

		// Second, get global connections (no project assignments)
		const globalConnections = await this.findGlobalConnections();

		// Combine and deduplicate by connection id
		const connectionMap = new Map<number, SecretsProviderConnection>();

		for (const conn of [...projectConnections, ...globalConnections]) {
			connectionMap.set(conn.id, conn);
		}

		return Array.from(connectionMap.values());
	}
}
